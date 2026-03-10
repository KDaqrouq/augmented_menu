/**
 * Model-generation worker. Run in a separate process: npm run worker
 * Requires REDIS_URL and DATABASE_URL.
 */
import { createModelGenerationWorker, testRedisConnection } from "../lib/queue";
import type { Worker } from "bullmq";

let worker: Worker | null = null;

async function main(): Promise<Worker> {
  try {
    await testRedisConnection();
    console.log("Redis: connected and ping OK.");
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
  const w = createModelGenerationWorker();
  console.log("Model-generation worker started. Waiting for jobs...");
  return w;
}

main().then((w) => {
  worker = w;
});

process.on("SIGTERM", async () => {
  if (worker) await worker.close();
  process.exit(0);
});
process.on("SIGINT", async () => {
  if (worker) await worker.close();
  process.exit(0);
});
