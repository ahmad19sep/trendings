import { describe, expect, it } from "vitest";

import {
  STALE_SOURCE_RUN_AFTER_MS,
  staleSourceRunCutoff,
} from "./recovery";

describe("stale source-run recovery", () => {
  it("uses the queue expiry plus a conservative grace period", () => {
    expect(STALE_SOURCE_RUN_AFTER_MS).toBe(30 * 60 * 1_000);

    const now = new Date("2026-11-25T00:30:00.000Z");
    expect(staleSourceRunCutoff(now)).toEqual(
      new Date("2026-11-25T00:00:00.000Z"),
    );
  });
});
