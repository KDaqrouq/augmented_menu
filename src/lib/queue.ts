import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { processGenerate3DJob } from "./process-generate-3d-job";

const QUEUE_NAME = "model-generation";

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required for the job queue");
  return url;
}

export type RedisConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  maxRetriesPerRequest?: number | null;
  tls?: Record<string, unknown> | object;
};

/**
 * Parse REDIS_URL into connection options for BullMQ.
 * Supports redis:// and rediss:// (TLS). Uses only host/port/username/password; no REST tokens.
 */
export function getRedisConnectionOptions(overrides?: Partial<RedisConnectionOptions>): RedisConnectionOptions {
  const url = getRedisUrl();
  const parsed = new URL(url);

  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis:// or rediss:// protocol");
  }
  if (parsed.pathname && parsed.pathname !== "/" && parsed.pathname !== "") {
    throw new Error("REDIS_URL must not include path (use redis://host:port only)");
  }

  const host = parsed.hostname;
  const port = parseInt(parsed.port || "6379", 10);
  const useTls = parsed.protocol === "rediss:";

  const opts: RedisConnectionOptions = {
    host,
    port,
    ...(parsed.username && { username: decodeURIComponent(parsed.username) }),
    ...(parsed.password && { password: decodeURIComponent(parsed.password) }),
    ...(useTls && { tls: { servername: host } }),
    ...overrides,
  };

  return opts;
}

/**
 * Test Redis connectivity (connect + PING). Use on worker startup.
 * Throws with a clear message if connection or ping fails.
 */
export async function testRedisConnection(): Promise<void> {
  const opts = getRedisConnectionOptions({ maxRetriesPerRequest: null });
  const client = new IORedis({
    host: opts.host,
    port: opts.port,
    username: opts.username,
    password: opts.password,
    maxRetriesPerRequest: opts.maxRetriesPerRequest ?? null,
    ...(opts.tls && { tls: opts.tls }),
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
};

export type DummyPayload = {
  type: "dummy";
};

export type JobPayload = Generate3DPayload | DummyPayload;

let queue: Queue<JobPayload> | null = null;

/**
 * Get the model-generation queue (lazy init).
 * Retries: 3 attempts with exponential backoff. Completed/failed jobs are trimmed so Redis does not grow indefinitely.
 */
export function getModelGenerationQueue(): Queue<JobPayload> {
  if (!queue) {
    const connection = getRedisConnectionOptions();
    queue = new Queue<JobPayload>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    });
  }
  return queue;
}

/**
 * Add a job to the queue. Use from API routes.
 * Uses job-level retry/backoff (3 attempts, exponential).
 */
export async function enqueueGenerate3D(payload: Generate3DPayload): Promise<string> {
  const q = getModelGenerationQueue();
  const job = await q.add("generate-3d", payload, {
    jobId: payload.processingJobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
  return job.id!;
}

/**
 * Enqueue a dummy job for testing (Checkpoint 3A).
 */
export async function enqueueDummyJob(): Promise<string> {
  const q = getModelGenerationQueue();
  const job = await q.add("dummy", { type: "dummy" });
  return job.id!;
}

/**
 * Create a worker that processes jobs. Run in a separate process (e.g. npm run worker).
 */
export function createModelGenerationWorker(): Worker<JobPayload, void> {
  const connection = getRedisConnectionOptions({ maxRetriesPerRequest: null });

  const worker = new Worker<JobPayload>(
    QUEUE_NAME,
    async (job: Job<JobPayload>) => {
      if (job.data.type === "dummy") {
        await job.log("Dummy job processed");
        return;
      }
      if (job.data.type === "generate-3d") {
        await processGenerate3DJob(job.data);
        return;
      }
      throw new Error("Unknown job type");
    },
    { connection, concurrency: 1 }
  );

  worker.on("completed", (j) => console.log("Job completed:", j.id));
  worker.on("failed", (j, err) => console.error("Job failed:", j?.id, err));
  return worker;
}
