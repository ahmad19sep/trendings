import { PgBoss } from "pg-boss";

import { runIngestionQueue } from "./ingestion";
import { workerLogger } from "./logger";
import { runRetention } from "./retention";
import { reconcileStaleSourceRuns } from "./recovery";
import {
  assertWorkerDefinitions,
  INGESTION_QUEUE_EXPIRE_SECONDS,
  oneShotIngestionQueues,
  queueDefinitions,
  queueNames,
  scheduleDefinitions,
  type IngestionQueueName,
} from "./schedules";

export interface RunningWorker {
  boss: PgBoss;
  stop(): Promise<void>;
}

interface StartWorkerDependencies {
  createBoss(options: ConstructorParameters<typeof PgBoss>[0]): PgBoss;
  recoverInterruptedSourceRuns(): Promise<void>;
  reportCleanupFailure(cleanupError: unknown, startupError: unknown): void;
}

const forcedStopOptions = {
  graceful: false,
  close: true,
  timeout: 30_000,
} as const;

const gracefulStopOptions = {
  graceful: true,
  close: true,
  // Queue handlers are allowed to run for twenty minutes. Keep pg-boss alive
  // for that window plus the same ten-minute grace used by stale-run recovery.
  timeout: (INGESTION_QUEUE_EXPIRE_SECONDS + 10 * 60) * 1_000,
} as const;

function createActiveWorkTracker() {
  const active = new Set<Promise<unknown>>();

  return {
    run<T>(work: () => Promise<T>): Promise<T> {
      const promise = Promise.resolve().then(work);
      active.add(promise);
      promise.then(
        () => active.delete(promise),
        () => active.delete(promise),
      );
      return promise;
    },
    async waitForIdle(): Promise<void> {
      // No new handlers can start after pg-boss stop resolves, but looping also
      // covers a handler registered at the edge of shutdown.
      while (active.size > 0) {
        await Promise.allSettled([...active]);
      }
    },
  };
}

async function recoverInterruptedSourceRuns(): Promise<void> {
  const recovered = await reconcileStaleSourceRuns();
  if (recovered.runs > 0) {
    workerLogger.warn(
      {
        runs: recovered.runs,
        sources: recovered.sources,
        cutoff: recovered.cutoff,
      },
      "stale source runs reconciled",
    );
  }
}

const defaultStartWorkerDependencies: StartWorkerDependencies = {
  createBoss(options) {
    return new PgBoss(options);
  },
  recoverInterruptedSourceRuns,
  reportCleanupFailure(cleanupError, startupError) {
    workerLogger.error(
      { error: cleanupError, startupError },
      "pg-boss cleanup failed after worker startup error",
    );
  },
};

export async function runOneShotIngestion(): Promise<void> {
  assertWorkerDefinitions();
  await recoverInterruptedSourceRuns();
  for (const queue of oneShotIngestionQueues) {
    const results = await runIngestionQueue(queue);
    workerLogger.info(
      {
        queue,
        succeeded: results.filter((result) => result.status === "success").length,
        failed: results.filter((result) => result.status === "error").length,
        items: results.reduce((sum, result) => sum + result.items, 0),
      },
      "one-shot queue complete",
    );
  }
}

export async function startWorker(
  dependencyOverrides: Partial<StartWorkerDependencies> = {},
): Promise<RunningWorker> {
  const dependencies = {
    ...defaultStartWorkerDependencies,
    ...dependencyOverrides,
  };
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to run the worker.");
  assertWorkerDefinitions();
  await dependencies.recoverInterruptedSourceRuns();

  const boss = dependencies.createBoss({
    connectionString,
    application_name: "creator-trend-radar-worker",
  });
  const activeWork = createActiveWorkTracker();
  try {
    boss.on("error", (error) => workerLogger.error({ error }, "pg-boss error"));
    await boss.start({ attempts: 3 });

    for (const { name, ...options } of queueDefinitions) {
      await boss.createQueue(name, options);
    }
    for (const schedule of scheduleDefinitions) {
      await boss.schedule(schedule.name, schedule.cron, {}, schedule.options);
    }

    for (const queue of oneShotIngestionQueues) {
      await boss.work(queue, { localConcurrency: 1, batchSize: 1 }, async () => {
        await activeWork.run(() =>
          runIngestionQueue(queue as IngestionQueueName).then(() => undefined),
        );
      });
    }
    await boss.work(queueNames.retention, { localConcurrency: 1, batchSize: 1 }, async () => {
      await activeWork.run(async () => {
        const result = await runRetention();
        workerLogger.info(result, "retention job complete");
      });
    });
  } catch (startupError) {
    try {
      await boss.stop(forcedStopOptions);
    } catch (cleanupError) {
      dependencies.reportCleanupFailure(cleanupError, startupError);
    }
    await activeWork.waitForIdle();
    throw startupError;
  }

  workerLogger.info(
    { queues: queueDefinitions.map((queue) => queue.name) },
    "worker started",
  );

  let stopping: Promise<void> | null = null;
  return {
    boss,
    stop() {
      stopping ??= (async () => {
        let stopError: unknown;
        try {
          await boss.stop(gracefulStopOptions);
        } catch (error) {
          stopError = error;
        }
        await activeWork.waitForIdle();
        if (stopError) throw stopError;
      })();
      return stopping;
    },
  };
}

