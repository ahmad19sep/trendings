import { randomUUID } from "node:crypto";

import { eq, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { closeDb, getDb } from "../db/client";
import * as schema from "../db/schema";

import {
  reconcileStaleSourceRuns,
  STALE_SOURCE_RUN_ERROR,
} from "./recovery";

const MINUTE = 60 * 1_000;
const acceptanceEnabled =
  process.env.RUN_DATABASE_ACCEPTANCE === "1" &&
  Boolean(process.env.DATABASE_URL);

describe.skipIf(!acceptanceEnabled)("stale source-run recovery acceptance", () => {
  afterAll(async () => {
    await closeDb();
  });

  it("reconciles only stale runs and protects health from newer evidence", async () => {
    const db = getDb();
    const marker = randomUUID();
    const now = new Date("2000-01-01T00:00:00.000Z");
    const sourceKeys = {
      stale: `recovery-stale:${marker}`,
      superseded: `recovery-superseded:${marker}`,
      fresh: `recovery-fresh:${marker}`,
    };

    const rollback = db.transaction(async (tx) => {
      const [staleSource, supersededSource, freshSource] = await tx
        .insert(schema.sources)
        .values([
          { key: sourceKeys.stale, name: "Recovery stale sentinel" },
          {
            key: sourceKeys.superseded,
            name: "Recovery superseded sentinel",
            lastError: "newer evidence must win",
            lastErrorAt: new Date(now.getTime() - 4 * MINUTE),
          },
          { key: sourceKeys.fresh, name: "Recovery fresh sentinel" },
        ])
        .returning({ id: schema.sources.id });
      if (!staleSource || !supersededSource || !freshSource) {
        throw new Error("Could not create recovery acceptance sources.");
      }

      const [staleRun] = await tx
        .insert(schema.sourceRuns)
        .values({
          sourceId: staleSource.id,
          status: "running",
          startedAt: new Date(now.getTime() - 31 * MINUTE),
          metadata: { preserved: "stale" },
        })
        .returning({ id: schema.sourceRuns.id });
      const [supersededRun] = await tx
        .insert(schema.sourceRuns)
        .values({
          sourceId: supersededSource.id,
          status: "running",
          startedAt: new Date(now.getTime() - 45 * MINUTE),
          metadata: { preserved: "superseded" },
        })
        .returning({ id: schema.sourceRuns.id });
      const [newerRun] = await tx
        .insert(schema.sourceRuns)
        .values({
          sourceId: supersededSource.id,
          status: "success",
          startedAt: new Date(now.getTime() - 5 * MINUTE),
          finishedAt: new Date(now.getTime() - 4 * MINUTE),
          metadata: { preserved: "newer" },
        })
        .returning({ id: schema.sourceRuns.id });
      const [freshRun] = await tx
        .insert(schema.sourceRuns)
        .values({
          sourceId: freshSource.id,
          status: "running",
          startedAt: new Date(now.getTime() - 29 * MINUTE),
          metadata: { preserved: "fresh" },
        })
        .returning({ id: schema.sourceRuns.id });
      if (!staleRun || !supersededRun || !newerRun || !freshRun) {
        throw new Error("Could not create recovery acceptance runs.");
      }

      const result = await reconcileStaleSourceRuns(tx, now);
      expect(result).toEqual({
        runs: 2,
        sources: 1,
        cutoff: new Date(now.getTime() - 30 * MINUTE),
      });

      const [recoveredStale] = await tx
        .select()
        .from(schema.sourceRuns)
        .where(eq(schema.sourceRuns.id, staleRun.id));
      expect(recoveredStale).toMatchObject({
        status: "error",
        finishedAt: now,
        errorCode: "StaleSourceRun",
        errorMessage: STALE_SOURCE_RUN_ERROR,
        metadata: {
          preserved: "stale",
          reconciledAt: now.toISOString(),
        },
      });

      const [recoveredSuperseded] = await tx
        .select()
        .from(schema.sourceRuns)
        .where(eq(schema.sourceRuns.id, supersededRun.id));
      expect(recoveredSuperseded).toMatchObject({
        status: "error",
        errorCode: "StaleSourceRun",
        metadata: {
          preserved: "superseded",
          reconciledAt: now.toISOString(),
        },
      });

      const [preservedNewer] = await tx
        .select()
        .from(schema.sourceRuns)
        .where(eq(schema.sourceRuns.id, newerRun.id));
      expect(preservedNewer).toMatchObject({
        status: "success",
        metadata: { preserved: "newer" },
      });
      const [preservedFresh] = await tx
        .select()
        .from(schema.sourceRuns)
        .where(eq(schema.sourceRuns.id, freshRun.id));
      expect(preservedFresh).toMatchObject({
        status: "running",
        metadata: { preserved: "fresh" },
      });

      const [staleHealth] = await tx
        .select({
          lastError: schema.sources.lastError,
          lastErrorAt: schema.sources.lastErrorAt,
        })
        .from(schema.sources)
        .where(eq(schema.sources.id, staleSource.id));
      expect(staleHealth).toEqual({
        lastError: STALE_SOURCE_RUN_ERROR,
        lastErrorAt: now,
      });

      const [supersededHealth] = await tx
        .select({
          lastError: schema.sources.lastError,
          lastErrorAt: schema.sources.lastErrorAt,
        })
        .from(schema.sources)
        .where(eq(schema.sources.id, supersededSource.id));
      expect(supersededHealth).toEqual({
        lastError: "newer evidence must win",
        lastErrorAt: new Date(now.getTime() - 4 * MINUTE),
      });

      tx.rollback();
    });

    try {
      await rollback;
      throw new Error("Recovery acceptance transaction unexpectedly committed.");
    } catch (error) {
      if (!(error instanceof TransactionRollbackError)) throw error;
    }
    for (const key of Object.values(sourceKeys)) {
      expect(
        await db
          .select({ id: schema.sources.id })
          .from(schema.sources)
          .where(eq(schema.sources.key, key)),
      ).toEqual([]);
    }
  }, 30_000);
});
