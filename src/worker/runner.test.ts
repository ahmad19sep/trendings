import type { PgBoss } from "pg-boss";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./ingestion", () => ({ runIngestionQueue: vi.fn() }));
vi.mock("./recovery", () => ({ reconcileStaleSourceRuns: vi.fn() }));
vi.mock("./retention", () => ({ runRetention: vi.fn() }));

import { runIngestionQueue } from "./ingestion";
import { startWorker } from "./runner";

function createBossDouble() {
  return {
    on: vi.fn(),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    createQueue: vi.fn(async () => undefined),
    schedule: vi.fn(async () => undefined),
    work: vi
      .fn<
        (
          name: string,
          options: unknown,
          handler: () => Promise<void>,
        ) => Promise<string>
      >()
      .mockResolvedValue("worker-id"),
  };
}

function startWithBoss(
  boss: ReturnType<typeof createBossDouble>,
  reportCleanupFailure = vi.fn(),
) {
  vi.stubEnv("DATABASE_URL", "postgres://worker-test.invalid/database");
  return {
    result: startWorker({
      createBoss: () => boss as unknown as PgBoss,
      recoverInterruptedSourceRuns: vi.fn(async () => undefined),
      reportCleanupFailure,
    }),
    reportCleanupFailure,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("worker startup cleanup", () => {
  it("force-stops pg-boss when start rejects and rethrows the original error", async () => {
    const startupError = new Error("pg-boss start failed");
    const boss = createBossDouble();
    boss.start.mockRejectedValue(startupError);

    const { result, reportCleanupFailure } = startWithBoss(boss);

    await expect(result).rejects.toBe(startupError);
    expect(boss.stop).toHaveBeenCalledOnce();
    expect(boss.stop).toHaveBeenCalledWith({
      graceful: false,
      close: true,
      timeout: 30_000,
    });
    expect(boss.createQueue).not.toHaveBeenCalled();
    expect(reportCleanupFailure).not.toHaveBeenCalled();
  });

  it("force-stops pg-boss when setup fails after a successful start", async () => {
    const setupError = new Error("queue creation failed");
    const boss = createBossDouble();
    boss.createQueue.mockRejectedValue(setupError);

    const { result, reportCleanupFailure } = startWithBoss(boss);

    await expect(result).rejects.toBe(setupError);
    expect(boss.start).toHaveBeenCalledOnce();
    expect(boss.stop).toHaveBeenCalledWith({
      graceful: false,
      close: true,
      timeout: 30_000,
    });
    expect(reportCleanupFailure).not.toHaveBeenCalled();
  });

  it("reports cleanup failure without masking the startup error", async () => {
    const startupError = new Error("worker registration failed");
    const cleanupError = new Error("pg-boss forced stop failed");
    const boss = createBossDouble();
    boss.work.mockRejectedValue(startupError);
    boss.stop.mockRejectedValue(cleanupError);
    const reportCleanupFailure = vi.fn();

    const { result } = startWithBoss(boss, reportCleanupFailure);

    await expect(result).rejects.toBe(startupError);
    expect(reportCleanupFailure).toHaveBeenCalledOnce();
    expect(reportCleanupFailure).toHaveBeenCalledWith(cleanupError, startupError);
  });
});

describe("worker graceful shutdown", () => {
  it("does not resolve while an ingestion handler is still active", async () => {
    let releaseHandler: (() => void) | undefined;
    const handlerGate = new Promise<void>((resolve) => {
      releaseHandler = resolve;
    });
    vi.mocked(runIngestionQueue).mockImplementationOnce(async () => {
      await handlerGate;
      return [];
    });
    const boss = createBossDouble();
    const { result } = startWithBoss(boss);
    const worker = await result;
    const firstHandler = boss.work.mock.calls[0]?.[2] as
      | (() => Promise<void>)
      | undefined;
    expect(firstHandler).toBeTypeOf("function");

    const handler = firstHandler!();
    let stopResolved = false;
    const stopping = worker.stop().then(() => {
      stopResolved = true;
    });
    await Promise.resolve();

    expect(boss.stop).toHaveBeenCalledWith({
      graceful: true,
      close: true,
      timeout: 30 * 60 * 1_000,
    });
    expect(stopResolved).toBe(false);

    releaseHandler?.();
    await handler;
    await stopping;
    expect(stopResolved).toBe(true);
  });
});
