import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { processGenerate3DJob } from "./process-generate-3d-job";
import { getRedisConnectionOptions } from "./redis-config";

export { getRedisConnectionOptions, type RedisConnectionOptions } from "./redis-config";

const QUEUE_NAME = "model-generation";

/** Retries are cheap: Tripo task ids are saved, so a retry polls instead of paying again. */
const JOB_ATTEMPTS = 3;

/**
 * Test Redis connectivity (connect + PING). Use on worker startup.
 * Throws with a clear message if connection or ping fails.
 */
export async function testRedisConnection(): Promise<void> {
  const opts = getRedisConnectionOptions({ maxRetriesPerRequest: null });
  const client = new IORedis({
    ...opts,
    maxRetriesPerRequest: opts.maxRetriesPerRequest ?? null,
    retryStrategy: () => null,
    connectTimeout: 10000,
  });
  try {
    await client.ping();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await client.quit().catch(() => {});
    throw new Error(`Redis connection failed: ${msg}. Check REDIS_URL (use rediss:// for TLS).`);
  }
  await client.quit();
}

export type Generate3DPayload = {
  type: "generate-3d";
  itemId: string;
  version: number;
  processingJobId: string;
  /** Whether to run GLB compression (from Vercel env ENABLE_GLTF_COMPRESSION). */
  enableCompression?: boolean;
};

export type DummyPayload = {
  type: "dummy";
};

export type JobPayload = Generate3DPayload | DummyPayload;

let queue: Queue<JobPayload> | null = null;

/**
 * Get the model-generation queue (lazy init).
 * Completed/failed jobs are trimmed so Redis does not grow indefinitely.
 */
export function getModelGenerationQueue(): Queue<JobPayload> {
  if (!queue) {
    queue = new Queue<JobPayload>(QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
        attempts: JOB_ATTEMPTS,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }
  return queue;
}

/** Add a generate-3d job. Uses the ProcessingJob id as the BullMQ job id. */
export async function enqueueGenerate3D(payload: Generate3DPayload): Promise<string> {
  const job = await getModelGenerationQueue().add("generate-3d", payload, {
    jobId: payload.processingJobId,
  });
  return job.id!;
}

/** Enqueue a dummy job for testing the queue + worker. */
export async function enqueueDummyJob(): Promise<string> {
  const job = await getModelGenerationQueue().add("dummy", { type: "dummy" }, { attempts: 1 });
  return job.id!;
}

/**
 * Create a worker that processes jobs. Run in a separate process (npm run worker).
 */
export function createModelGenerationWorker(): Worker<JobPayload, void> {
  const worker = new Worker<JobPayload>(
    QUEUE_NAME,
    async (job: Job<JobPayload>) => {
      if (job.data.type === "dummy") {
        await job.log("Dummy job processed");
        return;
      }
      if (job.data.type === "generate-3d") {
        const attempt = job.attemptsMade + 1;
        await processGenerate3DJob(job.data, {
          attempt,
          isFinalAttempt: attempt >= (job.opts.attempts ?? 1),
        });
        return;
      }
      throw new Error("Unknown job type");
    },
    { connection: getRedisConnectionOptions({ maxRetriesPerRequest: null }), concurrency: 1 }
  );

  worker.on("completed", (j) => console.log("Job completed:", j.id));
  worker.on("failed", (j, err) => console.error("Job failed:", j?.id, err.message));
  return worker;
}
