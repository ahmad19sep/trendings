import { closeDb } from "../src/db/client";
import { runOneShotIngestion } from "../src/worker/runner";

async function main() {
  const args = new Set(process.argv.slice(2));
  if (!args.has("--once")) {
    throw new Error("Use `pnpm ingest -- --once` for a manual ingestion pass.");
  }
  await runOneShotIngestion();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => closeDb());

