import { closeDb } from "../db/client";

import { workerLogger } from "./logger";
import type { RunningWorker } from "./runner";

interface ShutdownDependencies {
  closeDatabase(): Promise<void>;
  requested(signal: string): void;
  failed(error: unknown): void;
  setExitCode(code: number): void;
}

interface StartupFailureDependencies {
  closeDatabase(): Promise<void>;
  reportFailure(error: unknown): void;
  reportCloseFailure(error: unknown): void;
  setExitCode(code: number): void;
}

const defaultDependencies: ShutdownDependencies = {
  closeDatabase: closeDb,
  requested(signal) {
    workerLogger.info({ signal }, "worker shutdown requested");
  },
  failed(error) {
    workerLogger.error({ error }, "worker shutdown failed");
  },
  setExitCode(code) {
    process.exitCode = code;
  },
};

const defaultStartupFailureDependencies: StartupFailureDependencies = {
  closeDatabase: closeDb,
  reportFailure(error) {
    workerLogger.fatal({ error }, "worker failed to start");
  },
  reportCloseFailure(error) {
    workerLogger.error({ error }, "worker database cleanup failed after startup error");
  },
  setExitCode(code) {
    process.exitCode = code;
  },
};

export async function handleWorkerStartupFailure(
  error: unknown,
  dependencyOverrides: Partial<StartupFailureDependencies> = {},
): Promise<void> {
  const dependencies = {
    ...defaultStartupFailureDependencies,
    ...dependencyOverrides,
  };
  dependencies.reportFailure(error);
  try {
    await dependencies.closeDatabase();
  } catch (closeError) {
    dependencies.reportCloseFailure(closeError);
  }
  dependencies.setExitCode(1);
}

export function createWorkerShutdown(
  worker: Pick<RunningWorker, "stop">,
  dependencyOverrides: Partial<ShutdownDependencies> = {},
): (signal: string) => Promise<void> {
  const dependencies = {
    ...defaultDependencies,
    ...dependencyOverrides,
  };
  let stopping: Promise<void> | null = null;

  return (signal: string) => {
    if (stopping) return stopping;

    dependencies.requested(signal);
    stopping = (async () => {
      let failure: unknown;
      try {
        await worker.stop();
      } catch (error) {
        failure = error;
      }

      try {
        await dependencies.closeDatabase();
      } catch (error) {
        failure ??= error;
      }

      if (failure) {
        dependencies.failed(failure);
        dependencies.setExitCode(1);
        return;
      }
      dependencies.setExitCode(0);
    })();

    return stopping;
  };
}
