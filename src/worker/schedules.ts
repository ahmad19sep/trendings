import type {
  QueueOptions,
  QueuePolicy,
  ScheduleOptions,
} from "pg-boss";

export const queueNames = {
  googleTrends: "ingest-google-trends",
  googleNews: "ingest-google-news",
  publisherTierOne: "ingest-publisher-tier-one",
  publisherTierTwo: "ingest-publisher-tier-two",
  gdelt: "ingest-gdelt",
  retention: "retention",
} as const;

export type WorkerQueueName = (typeof queueNames)[keyof typeof queueNames];
export type IngestionQueueName = Exclude<WorkerQueueName, "retention">;

export interface QueueDefinition extends QueueOptions {
  name: WorkerQueueName;
  policy: QueuePolicy;
  notify: boolean;
}

const ingestionQueueDefaults = {
  policy: "exclusive",
  notify: true,
  retryLimit: 2,
  retryDelay: 30,
  retryBackoff: true,
  retryDelayMax: 15 * 60,
  expireInSeconds: 20 * 60,
  retentionSeconds: 24 * 60 * 60,
  deleteAfterSeconds: 7 * 24 * 60 * 60,
} as const satisfies Omit<QueueDefinition, "name">;

export const queueDefinitions: readonly QueueDefinition[] = [
  { name: queueNames.googleTrends, ...ingestionQueueDefaults },
  { name: queueNames.googleNews, ...ingestionQueueDefaults },
  { name: queueNames.publisherTierOne, ...ingestionQueueDefaults },
  { name: queueNames.publisherTierTwo, ...ingestionQueueDefaults },
  { name: queueNames.gdelt, ...ingestionQueueDefaults },
  {
    name: queueNames.retention,
    policy: "exclusive",
    notify: true,
    retryLimit: 2,
    retryDelay: 5 * 60,
    retryBackoff: true,
    retryDelayMax: 60 * 60,
    expireInSeconds: 30 * 60,
    retentionSeconds: 24 * 60 * 60,
    deleteAfterSeconds: 30 * 24 * 60 * 60,
  },
] as const;

export interface ScheduleDefinition {
  name: WorkerQueueName;
  cron: string;
  key: string;
  options: ScheduleOptions;
}

const scheduleDefaults = {
  tz: "Asia/Karachi",
  missed: "once",
  singletonKey: "scheduled",
  singletonSeconds: 60,
  retryLimit: 2,
  retryDelay: 30,
  retryBackoff: true,
  retryDelayMax: 15 * 60,
} as const satisfies ScheduleOptions;

/**
 * Staggering the feeds keeps the application-wide outbound queue comfortably
 * below its two requests/second safety ceiling. The workers also apply the
 * connector-specific spacing within each batch.
 */
export const scheduleDefinitions: readonly ScheduleDefinition[] = [
  {
    name: queueNames.googleTrends,
    cron: "*/30 * * * *",
    key: "phase-1-google-trends",
    options: { ...scheduleDefaults, key: "phase-1-google-trends" },
  },
  {
    name: queueNames.googleNews,
    cron: "7,37 * * * *",
    key: "phase-1-google-news",
    options: { ...scheduleDefaults, key: "phase-1-google-news" },
  },
  {
    name: queueNames.publisherTierOne,
    cron: "12,27,42,57 * * * *",
    key: "phase-1-publisher-tier-one",
    options: { ...scheduleDefaults, key: "phase-1-publisher-tier-one" },
  },
  {
    name: queueNames.publisherTierTwo,
    cron: "22 * * * *",
    key: "phase-1-publisher-tier-two",
    options: { ...scheduleDefaults, key: "phase-1-publisher-tier-two" },
  },
  {
    name: queueNames.gdelt,
    cron: "17,47 * * * *",
    key: "phase-1-gdelt",
    options: { ...scheduleDefaults, key: "phase-1-gdelt" },
  },
  {
    name: queueNames.retention,
    cron: "15 3 * * *",
    key: "phase-1-retention",
    options: {
      ...scheduleDefaults,
      key: "phase-1-retention",
      retryDelay: 5 * 60,
      retryDelayMax: 60 * 60,
    },
  },
] as const;

export const oneShotIngestionQueues: readonly IngestionQueueName[] = [
  queueNames.googleTrends,
  queueNames.googleNews,
  queueNames.publisherTierOne,
  queueNames.publisherTierTwo,
  queueNames.gdelt,
] as const;

export function assertWorkerDefinitions(): void {
  const queueSet = new Set(queueDefinitions.map((definition) => definition.name));
  if (queueSet.size !== queueDefinitions.length) {
    throw new Error("Worker queue names must be unique.");
  }

  const scheduleKeys = new Set<string>();
  for (const schedule of scheduleDefinitions) {
    if (!queueSet.has(schedule.name)) {
      throw new Error(`Schedule ${schedule.key} targets an unknown queue.`);
    }
    if (scheduleKeys.has(schedule.key)) {
      throw new Error(`Duplicate schedule key: ${schedule.key}`);
    }
    scheduleKeys.add(schedule.key);
  }

  for (const definition of queueDefinitions) {
    if (definition.policy !== "exclusive") {
      throw new Error(`${definition.name} must use the exclusive queue policy.`);
    }
  }
}

