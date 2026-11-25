import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getDomain } from "tldts";

import * as schema from "../db/schema";
import type { ConnectorCapabilities, RawItem } from "../lib/connectors";

import type { HttpValidators, RecordedPayload } from "./http-client";

type Database = NodePgDatabase<typeof schema>;
type DatabaseTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];
type DatabaseExecutor = Database | DatabaseTransaction;

export interface SourceIdentity {
  id: string;
  key: string;
}

export interface PersistedItemBatch {
  count: number;
  itemIds: string[];
  listLength: number;
}

export async function upsertSource(
  db: Database,
  input: {
    key: string;
    label: string;
    capabilities: ConnectorCapabilities;
  },
): Promise<SourceIdentity> {
  const [row] = await db
    .insert(schema.sources)
    .values({
      key: input.key,
      name: input.label,
      enabled: true,
      phase: 1,
      access: input.capabilities.access,
      capabilities: input.capabilities as unknown as Record<string, unknown>,
      supportedMarkets: [...input.capabilities.supportedMarkets],
      staleAfterMinutes: Math.max(
        1,
        Math.round(input.capabilities.minimumRefreshIntervalMs / 60_000) * 2,
      ),
    })
    .onConflictDoUpdate({
      target: schema.sources.key,
      set: {
        name: input.label,
        access: input.capabilities.access,
        capabilities: input.capabilities as unknown as Record<string, unknown>,
        supportedMarkets: [...input.capabilities.supportedMarkets],
        updatedAt: new Date(),
      },
    })
    .returning({ id: schema.sources.id, key: schema.sources.key });

  if (!row) throw new Error(`Could not upsert source ${input.key}.`);
  return row;
}

export async function startSourceRun(
  db: Database,
  sourceId: string,
): Promise<string> {
  const [run] = await db
    .insert(schema.sourceRuns)
    .values({ sourceId, status: "running", quotaCost: "0" })
    .returning({ id: schema.sourceRuns.id });
  if (!run) throw new Error("Could not create source run.");
  return run.id;
}

export async function loadLatestHttpValidators(
  db: Database,
  sourceId: string,
): Promise<HttpValidators> {
  const [payload] = await db
    .select({
      etag: schema.rawPayloads.etag,
      lastModified: schema.rawPayloads.lastModified,
    })
    .from(schema.rawPayloads)
    .innerJoin(
      schema.sourceRuns,
      eq(schema.rawPayloads.sourceRunId, schema.sourceRuns.id),
    )
    .where(
      and(
        eq(schema.rawPayloads.sourceId, sourceId),
        eq(schema.sourceRuns.status, "success"),
      ),
    )
    .orderBy(desc(schema.rawPayloads.fetchedAt))
    .limit(1);

  return {
    etag: payload?.etag ?? null,
    lastModified: payload?.lastModified ?? null,
  };
}

export async function persistRawPayloads(
  db: DatabaseExecutor,
  input: {
    sourceId: string;
    sourceRunId: string;
    payloads: readonly RecordedPayload[];
    now?: Date;
  },
): Promise<string[]> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  const ids: string[] = [];

  for (const payload of input.payloads) {
    const compressed = gzipSync(Buffer.from(payload.body, "utf8")).toString(
      "base64",
    );
    const [record] = await db
      .insert(schema.rawPayloads)
      .values({
        sourceRunId: input.sourceRunId,
        sourceId: input.sourceId,
        contentType: payload.contentType,
        bodyCompressed: compressed,
        contentHash: payload.contentHash,
        etag: payload.etag,
        lastModified: payload.lastModified,
        fetchedAt: payload.fetchedAt,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [schema.rawPayloads.sourceId, schema.rawPayloads.contentHash],
        set: {
          sourceRunId: input.sourceRunId,
          fetchedAt: payload.fetchedAt,
          expiresAt,
          etag: payload.etag,
          lastModified: payload.lastModified,
        },
      })
      .returning({ id: schema.rawPayloads.id });
    if (record) ids.push(record.id);
  }

  return ids;
}

export async function persistItems(
  db: DatabaseExecutor,
  input: {
    source: SourceIdentity;
    items: readonly RawItem[];
    rawPayloadId?: string;
  },
): Promise<PersistedItemBatch> {
  let persisted = 0;
  const itemIds: string[] = [];

  for (const item of input.items) {
    const canonicalUrl = canonicalizeUrl(item.url);
    const imageUrl = stringMetadata(
      item.sourceMetadata.imageUrl ?? item.sourceMetadata.pictureUrl,
    );
    const publishedAt = parseDate(item.publishedAt);
    const fetchedAt = parseDate(item.fetchedAt) ?? new Date();
    const externalId = `${input.source.key}:${item.externalId}`;
    const contentHash = createHash("sha256")
      .update(
        [item.titleOriginal, item.summaryOriginal ?? "", canonicalUrl ?? item.url].join(
          "\n",
        ),
      )
      .digest("hex");

    const [record] = await db
      .insert(schema.items)
      .values({
        sourceId: input.source.id,
        connector: item.connector,
        externalId,
        url: item.url,
        canonicalUrl,
        registrableDomain: canonicalUrl
          ? getDomain(new URL(canonicalUrl).hostname)
          : null,
        outletName: item.sourceName,
        publisherCountry: item.publisherCountry,
        language: item.language,
        languageDetectionMethod: item.languageDetectionMethod,
        titleOriginal: item.titleOriginal,
        titleEn: item.titleEnglish,
        summaryOriginal: item.summaryOriginal?.slice(0, 300) ?? null,
        publishedAt,
        firstSeenAt: fetchedAt,
        lastSeenAt: fetchedAt,
        fetchedAt,
        nativePosition: item.nativePosition,
        nativeMetricName: item.nativeMetricName,
        nativeMetricValue:
          item.nativeMetricValue === null
            ? null
            : String(item.nativeMetricValue),
        nativeMetricUnit: item.nativeMetricUnit,
        reportingWindow: item.reportingWindow,
        trendMarket: item.trendMarket,
        storyLocations: item.storyLocation ? [item.storyLocation] : [],
        targetAudiences: [...item.targetAudienceLanguages],
        imageUrl,
        origin: "live",
        parserVersion: "feed-connectors-v1",
        retrievalStatus: "ok",
        contentHash,
        rawRef: input.rawPayloadId,
      })
      .onConflictDoUpdate({
        target: [schema.items.connector, schema.items.externalId],
        set: {
          sourceId: input.source.id,
          url: item.url,
          canonicalUrl,
          registrableDomain: canonicalUrl
            ? getDomain(new URL(canonicalUrl).hostname)
            : null,
          outletName: item.sourceName,
          publisherCountry: item.publisherCountry,
          language: item.language,
          languageDetectionMethod: item.languageDetectionMethod,
          titleOriginal: item.titleOriginal,
          titleEn: item.titleEnglish,
          summaryOriginal: item.summaryOriginal?.slice(0, 300) ?? null,
          publishedAt,
          lastSeenAt: fetchedAt,
          fetchedAt,
          nativePosition: item.nativePosition,
          nativeMetricName: item.nativeMetricName,
          nativeMetricValue:
            item.nativeMetricValue === null
              ? null
              : String(item.nativeMetricValue),
          nativeMetricUnit: item.nativeMetricUnit,
          reportingWindow: item.reportingWindow,
          trendMarket: item.trendMarket,
          storyLocations: item.storyLocation ? [item.storyLocation] : [],
          targetAudiences: [...item.targetAudienceLanguages],
          imageUrl,
          contentHash,
          rawRef: input.rawPayloadId,
          retrievalStatus: "ok",
          updatedAt: new Date(),
        },
      })
      .returning({ id: schema.items.id });
    if (!record) {
      throw new Error(`Could not persist item ${externalId}.`);
    }
    itemIds.push(record.id);
    persisted += 1;
  }

  return {
    count: persisted,
    itemIds,
    listLength: input.items.length,
  };
}

export async function finishSourceRun(
  db: DatabaseExecutor,
  input: {
    sourceId: string;
    sourceRunId: string;
    itemsFetched: number;
    attempts: number;
    httpStatus?: number | null;
    notModified?: boolean;
  },
): Promise<void> {
  const now = new Date();
  await db
    .update(schema.sourceRuns)
    .set({
      status: "success",
      finishedAt: now,
      itemsFetched: input.itemsFetched,
      httpStatus: input.httpStatus ?? null,
      metadata: input.notModified
        ? { attempts: input.attempts, notModified: true }
        : { attempts: input.attempts },
    })
    .where(eq(schema.sourceRuns.id, input.sourceRunId));
  await db
    .update(schema.sources)
    .set({
      lastSuccessAt: now,
      lastError: null,
      updatedAt: now,
    })
    .where(eq(schema.sources.id, input.sourceId));
}

export async function failSourceRun(
  db: Database,
  input: {
    sourceId: string;
    sourceRunId: string;
    error: unknown;
    attempts: number;
    httpStatus?: number | null;
  },
): Promise<void> {
  const now = new Date();
  const message = errorMessage(input.error);
  await db
    .update(schema.sourceRuns)
    .set({
      status: "error",
      finishedAt: now,
      itemsFetched: null,
      httpStatus: input.httpStatus ?? null,
      errorCode:
        input.error instanceof Error ? input.error.name.slice(0, 120) : "Error",
      errorMessage: message,
      metadata: { attempts: input.attempts },
    })
    .where(eq(schema.sourceRuns.id, input.sourceRunId));
  await db
    .update(schema.sources)
    .set({ lastErrorAt: now, lastError: message, updatedAt: now })
    .where(eq(schema.sources.id, input.sourceId));
}

export function canonicalizeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      const normalized = key.toLowerCase();
      if (
        normalized.startsWith("utm_") ||
        normalized === "fbclid" ||
        normalized === "gclid" ||
        normalized === "ref"
      ) {
        url.searchParams.delete(key);
      }
    }
    url.pathname = url.pathname.replace(/\/amp\/?$/i, "/");
    return url.toString();
  } catch {
    return null;
  }
}

function stringMetadata(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 2_000);
  return String(error).slice(0, 2_000);
}

