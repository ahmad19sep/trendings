import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getDb } from "../db/client";
import * as schema from "../db/schema";

import {
  ConnectorHttpError,
  ConnectorNotModifiedError,
  RecordingFetchClient,
} from "./http-client";
import {
  failSourceRun,
  finishSourceRun,
  loadLatestHttpValidators,
  persistItems,
  persistRawPayloads,
  startSourceRun,
  upsertSource,
} from "./persistence";
import {
  connectorDescriptorsForQueue,
  requestSpacingMs,
  type ConnectorDescriptor,
} from "./registry";
import type { IngestionQueueName } from "./schedules";
import { workerLogger } from "./logger";
import { materializeItemsIntoTopics } from "./topic-pipeline";

type Database = NodePgDatabase<typeof schema>;

export interface ConnectorRunResult {
  sourceKey: string;
  status: "success" | "error";
  items: number;
  attempts: number;
  notModified?: true;
  error?: string;
}

const MAX_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RunDescriptorDependencies {
  createClient(): RecordingFetchClient;
  upsertSource: typeof upsertSource;
  loadLatestHttpValidators: typeof loadLatestHttpValidators;
  startSourceRun: typeof startSourceRun;
  persistRawPayloads: typeof persistRawPayloads;
  persistItems: typeof persistItems;
  materializeItemsIntoTopics: typeof materializeItemsIntoTopics;
  finishSourceRun: typeof finishSourceRun;
  failSourceRun: typeof failSourceRun;
  sleep(ms: number): Promise<void>;
}

const defaultRunDescriptorDependencies: RunDescriptorDependencies = {
  createClient: () => new RecordingFetchClient(),
  upsertSource,
  loadLatestHttpValidators,
  startSourceRun,
  persistRawPayloads,
  persistItems,
  materializeItemsIntoTopics,
  finishSourceRun,
  failSourceRun,
  sleep,
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function retryDelay(error: unknown, attempt: number): number {
  if (error instanceof ConnectorHttpError && error.retryAfterMs !== null) {
    return error.retryAfterMs;
  }
  const exponential = Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1));
  return exponential + Math.floor(Math.random() * Math.max(250, exponential / 4));
}

export async function runDescriptor(
  db: Database,
  descriptor: ConnectorDescriptor,
  dependencyOverrides: Partial<RunDescriptorDependencies> = {},
): Promise<ConnectorRunResult> {
  const dependencies = {
    ...defaultRunDescriptorDependencies,
    ...dependencyOverrides,
  };
  const client = dependencies.createClient();
  const connector = descriptor.makeConnector(client);
  const source = await dependencies.upsertSource(db, {
    key: descriptor.sourceKey,
    label: descriptor.label,
    capabilities: connector.capabilities(),
  });
  client.setValidators(
    await dependencies.loadLatestHttpValidators(db, source.id),
  );
  const sourceRunId = await dependencies.startSourceRun(db, source.id);
  let attempts = 0;
  let lastError: unknown;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    try {
      const items = await connector.fetch();
      const rawIds = await dependencies.persistRawPayloads(db, {
        sourceId: source.id,
        sourceRunId,
        payloads: client.payloads,
      });
      const persisted = await dependencies.persistItems(db, {
        source,
        items,
        rawPayloadId: rawIds[0],
      });
      const materialized = await dependencies.materializeItemsIntoTopics(db, {
        itemIds: persisted.itemIds,
        listLength: persisted.listLength,
      });
      await dependencies.finishSourceRun(db, {
        sourceId: source.id,
        sourceRunId,
        itemsFetched: persisted.count,
        attempts,
      });
      workerLogger.info(
        {
          sourceKey: descriptor.sourceKey,
          items: persisted.count,
          topics: materialized.topicIds.length,
          attempts,
        },
        "connector ingestion complete",
      );
      return {
        sourceKey: descriptor.sourceKey,
        status: "success",
        items: persisted.count,
        attempts,
      };
    } catch (error) {
      if (error instanceof ConnectorNotModifiedError) {
        await dependencies.finishSourceRun(db, {
          sourceId: source.id,
          sourceRunId,
          itemsFetched: 0,
          attempts,
          httpStatus: error.status,
          notModified: true,
        });
        workerLogger.info(
          { sourceKey: descriptor.sourceKey, attempts },
          "connector content not modified",
        );
        return {
          sourceKey: descriptor.sourceKey,
          status: "success",
          items: 0,
          attempts,
          notModified: true,
        };
      }

      lastError = error;
      if (attempts < MAX_ATTEMPTS) {
        const delay = retryDelay(error, attempts);
        workerLogger.warn(
          { sourceKey: descriptor.sourceKey, attempts, retryInMs: delay },
          "connector attempt failed",
        );
        await dependencies.sleep(delay);
      }
    }
  }

  if (client.payloads.length) {
    await dependencies.persistRawPayloads(db, {
      sourceId: source.id,
      sourceRunId,
      payloads: client.payloads,
    });
  }
  await dependencies.failSourceRun(db, {
    sourceId: source.id,
    sourceRunId,
    error: lastError,
    attempts,
    httpStatus:
      lastError instanceof ConnectorHttpError ? lastError.status : null,
  });
  workerLogger.error(
    { sourceKey: descriptor.sourceKey, attempts, error: errorText(lastError) },
    "connector ingestion failed independently",
  );
  return {
    sourceKey: descriptor.sourceKey,
    status: "error",
    items: 0,
    attempts,
    error: errorText(lastError),
  };
}

export async function runIngestionQueue(
  queue: IngestionQueueName,
  db: Database = getDb(),
): Promise<ConnectorRunResult[]> {
  const descriptors = await connectorDescriptorsForQueue(queue);
  const results: ConnectorRunResult[] = [];

  for (const [index, descriptor] of descriptors.entries()) {
    try {
      results.push(await runDescriptor(db, descriptor));
    } catch (error) {
      // A database-level failure is recorded in process logs, but another
      // provider still gets its turn. Provider failures never stop the batch.
      workerLogger.error(
        { sourceKey: descriptor.sourceKey, error: errorText(error) },
        "connector orchestration failed",
      );
      results.push({
        sourceKey: descriptor.sourceKey,
        status: "error",
        items: 0,
        attempts: 0,
        error: errorText(error),
      });
    }

    if (index < descriptors.length - 1) {
      await sleep(requestSpacingMs(queue));
    }
  }

  return results;
}

