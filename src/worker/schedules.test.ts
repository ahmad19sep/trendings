import { describe, expect, it } from "vitest";

import {
  assertWorkerDefinitions,
  oneShotIngestionQueues,
  queueDefinitions,
  queueNames,
  scheduleDefinitions,
} from "./schedules";

describe("worker schedule definitions", () => {
  it("uses database-enforced exclusive queues for duplicate-run protection", () => {
    expect(() => assertWorkerDefinitions()).not.toThrow();
    expect(queueDefinitions.every((queue) => queue.policy === "exclusive")).toBe(
      true,
    );
  });

  it("uses stable, unique schedule keys in Asia/Karachi", () => {
    expect(new Set(scheduleDefinitions.map((entry) => entry.key)).size).toBe(
      scheduleDefinitions.length,
    );
    expect(
      scheduleDefinitions.every(
        (entry) =>
          entry.options.key === entry.key &&
          entry.options.tz === "Asia/Karachi" &&
          entry.options.missed === "once",
      ),
    ).toBe(true);
  });

  it("keeps retention out of a manual ingestion pass", () => {
    expect(oneShotIngestionQueues).not.toContain(queueNames.retention);
    expect(oneShotIngestionQueues).toHaveLength(5);
    expect(oneShotIngestionQueues).toContain(queueNames.gdelt);
  });
});

