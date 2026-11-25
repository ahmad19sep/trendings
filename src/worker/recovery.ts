import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getDb } from "../db/client";
import * as schema from "../db/schema";

import { INGESTION_QUEUE_EXPIRE_SECONDS } from "./schedules";

type Database = NodePgDatabase<typeof schema>;
type DatabaseTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];
type DatabaseExecutor = Database | DatabaseTransaction;

const STALE_SOURCE_RUN_GRACE_MS = 10 * 60 * 1_000;
export const STALE_SOURCE_RUN_AFTER_MS =
  INGESTION_QUEUE_EXPIRE_SECONDS * 1_000 + STALE_SOURCE_RUN_GRACE_MS;
export const STALE_SOURCE_RUN_ERROR =
  "The worker stopped before this source run completed; startup recovery marked it stale.";

export interface SourceRunRecoveryResult {
  runs: number;
  sources: number;
  cutoff: Date;
}

interface LockedSourceRun extends Record<string, unknown> {
  runId: string;
  sourceId: string;
  startedAt: Date | string;
}

function lockedRunStartedAt(value: Date | string): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid source-run timestamp returned by PostgreSQL: ${value}`);
  }
  return parsed;
}

export function staleSourceRunCutoff(now = new Date()): Date {
  return new Date(now.getTime() - STALE_SOURCE_RUN_AFTER_MS);
}

/**
 * Reconciles runs that outlived the 20-minute pg-boss job expiry plus a
 * ten-minute grace period. Locking the source rows prevents a concurrent
 * upsert/start from racing the source-health update.
 */
export async function reconcileStaleSourceRuns(
  db: DatabaseExecutor = getDb(),
  now = new Date(),
): Promise<SourceRunRecoveryResult> {
  const cutoff = staleSourceRunCutoff(now);

  return db.transaction(async (tx) => {
    const lockedResult = await tx.execute<LockedSourceRun>(sql`
      select
        source_runs.id as "runId",
        source_runs.source_id as "sourceId",
        source_runs.started_at as "startedAt"
      from ${schema.sourceRuns} as source_runs
      inner join ${schema.sources} as sources
        on sources.id = source_runs.source_id
      where source_runs.status = 'running'
        and source_runs.started_at < ${cutoff}
      for update of source_runs, sources
    `);
    const locked = lockedResult.rows;
    if (locked.length === 0) {
      return { runs: 0, sources: 0, cutoff };
    }

    await tx
      .update(schema.sourceRuns)
      .set({
        status: "error",
        finishedAt: now,
        errorCode: "StaleSourceRun",
        errorMessage: STALE_SOURCE_RUN_ERROR,
        metadata: sql`${schema.sourceRuns.metadata} || jsonb_build_object(
          'reconciledAt', cast(${now.toISOString()} as text)
        )`,
      })
      .where(
        inArray(
          schema.sourceRuns.id,
          locked.map((row) => row.runId),
        ),
      );

    const latestStaleBySource = new Map<string, Date>();
    for (const row of locked) {
      const startedAt = lockedRunStartedAt(row.startedAt);
      const previous = latestStaleBySource.get(row.sourceId);
      if (!previous || previous < startedAt) {
        latestStaleBySource.set(row.sourceId, startedAt);
      }
    }

    const sourcesToMark: string[] = [];
    for (const [sourceId, staleStartedAt] of latestStaleBySource) {
      const [newerRun] = await tx
        .select({ id: schema.sourceRuns.id })
        .from(schema.sourceRuns)
        .where(
          and(
            eq(schema.sourceRuns.sourceId, sourceId),
            gt(schema.sourceRuns.startedAt, staleStartedAt),
          ),
        )
        .limit(1);
      if (!newerRun) sourcesToMark.push(sourceId);
    }

    if (sourcesToMark.length > 0) {
      await tx
        .update(schema.sources)
        .set({
          lastErrorAt: now,
          lastError: STALE_SOURCE_RUN_ERROR,
          updatedAt: now,
        })
        .where(inArray(schema.sources.id, sourcesToMark));
    }

    return {
      runs: locked.length,
      sources: sourcesToMark.length,
      cutoff,
    };
  });
}
