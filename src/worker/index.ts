import { startWorker } from "./runner";
import { workerLogger } from "./logger";

async function main() {
  const worker = await startWorker();
  const shutdown = async (signal: string) => {
    workerLogger.info({ signal }, "worker shutdown requested");
    await worker.stop();
    process.exitCode = 0;
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  workerLogger.fatal({ error }, "worker failed to start");
  process.exitCode = 1;
});

