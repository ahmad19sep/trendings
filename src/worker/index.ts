import { startWorker } from "./runner";
import {
  createWorkerShutdown,
  handleWorkerStartupFailure,
} from "./shutdown";

async function main() {
  const worker = await startWorker();
  const shutdown = createWorkerShutdown(worker);

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch(handleWorkerStartupFailure);

