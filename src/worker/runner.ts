import { PgBoss } from "pg-boss";

import { runIngestionQueue } from "./ingestion";
import { workerLogger } from "./logger";
import { runRetention } from "./retention";
import {
  assertWorkerDefinitions,
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

export async function runOneShotIngestion(): Promise<void> {
  assertWorkerDefinitions();
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

export async function startWorker(): Promise<RunningWorker> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to run the worker.");
  assertWorkerDefinitions();

  const boss = new PgBoss({
    connectionString,
    application_name: "creator-trend-radar-worker",
  });
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
      await runIngestionQueue(queue as IngestionQueueName);
    });
  }
  await boss.work(queueNames.retention, { localConcurrency: 1, batchSize: 1 }, async () => {
    const result = await runRetention();
    workerLogger.info(result, "retention job complete");
  });

  workerLogger.info(
    { queues: queueDefinitions.map((queue) => queue.name) },
    "worker started",
  );

  let stopping: Promise<void> | null = null;
  return {
    boss,
    stop() {
      stopping ??= boss.stop({ graceful: true, close: true, timeout: 30_000 });
      return stopping;
    },
  };
}

