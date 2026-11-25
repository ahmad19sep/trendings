import { describe, expect, it, vi } from "vitest";

import {
  createWorkerShutdown,
  handleWorkerStartupFailure,
} from "./shutdown";

describe("worker shutdown", () => {
  it("shares one cleanup across repeated signals and closes in order", async () => {
    let releaseStop: (() => void) | undefined;
    const stopGate = new Promise<void>((resolve) => {
      releaseStop = resolve;
    });
    const events: string[] = [];
    const stop = vi.fn(async () => {
      events.push("stop");
      await stopGate;
    });
    const closeDatabase = vi.fn(async () => {
      events.push("close");
    });
    const requested = vi.fn();
    const failed = vi.fn();
    const setExitCode = vi.fn();
    const shutdown = createWorkerShutdown(
      { stop },
      { closeDatabase, requested, failed, setExitCode },
    );

    const first = shutdown("SIGINT");
    const repeated = shutdown("SIGTERM");

    expect(repeated).toBe(first);
    expect(stop).toHaveBeenCalledOnce();
    expect(closeDatabase).not.toHaveBeenCalled();
    expect(requested).toHaveBeenCalledOnce();
    expect(requested).toHaveBeenCalledWith("SIGINT");

    releaseStop?.();
    await first;

    expect(events).toEqual(["stop", "close"]);
    expect(closeDatabase).toHaveBeenCalledOnce();
    expect(failed).not.toHaveBeenCalled();
    expect(setExitCode).toHaveBeenCalledOnce();
    expect(setExitCode).toHaveBeenCalledWith(0);
  });

  it("still closes the database and reports failure when pg-boss stop fails", async () => {
    const stopError = new Error("pg-boss stop failed");
    const stop = vi.fn(async () => {
      throw stopError;
    });
    const closeDatabase = vi.fn(async () => undefined);
    const failed = vi.fn();
    const setExitCode = vi.fn();
    const shutdown = createWorkerShutdown(
      { stop },
      {
        closeDatabase,
        requested: vi.fn(),
        failed,
        setExitCode,
      },
    );

    await shutdown("SIGTERM");

    expect(stop).toHaveBeenCalledOnce();
    expect(closeDatabase).toHaveBeenCalledOnce();
    expect(failed).toHaveBeenCalledWith(stopError);
    expect(setExitCode).toHaveBeenCalledWith(1);
  });
});

describe("worker startup failure", () => {
  it("closes an app pool opened before pg-boss startup failed", async () => {
    const startupError = new Error("pg-boss start failed");
    const closeDatabase = vi.fn(async () => undefined);
    const reportFailure = vi.fn();
    const reportCloseFailure = vi.fn();
    const setExitCode = vi.fn();

    await handleWorkerStartupFailure(startupError, {
      closeDatabase,
      reportFailure,
      reportCloseFailure,
      setExitCode,
    });

    expect(reportFailure).toHaveBeenCalledWith(startupError);
    expect(closeDatabase).toHaveBeenCalledOnce();
    expect(reportCloseFailure).not.toHaveBeenCalled();
    expect(setExitCode).toHaveBeenCalledWith(1);
  });

  it("still reports failure when startup cleanup also fails", async () => {
    const closeError = new Error("pool close failed");
    const reportCloseFailure = vi.fn();
    const setExitCode = vi.fn();

    await handleWorkerStartupFailure(new Error("startup failed"), {
      closeDatabase: vi.fn(async () => {
        throw closeError;
      }),
      reportFailure: vi.fn(),
      reportCloseFailure,
      setExitCode,
    });

    expect(reportCloseFailure).toHaveBeenCalledWith(closeError);
    expect(setExitCode).toHaveBeenCalledWith(1);
  });
});
