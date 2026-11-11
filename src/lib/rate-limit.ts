import IORedis from "ioredis";
import { getRedisConnectionOptions } from "./redis-config";

/**
 * Fixed-window rate limiter.
 * - "shared": Redis when REDIS_URL is set (works across serverless instances), memory otherwise.
 * - "memory": per-instance only; cheap, best-effort (used for high-volume analytics).
 */

type Store = "shared" | "memory";

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();
let redis: IORedis | null = null;

function getRedis(): IORedis | null {
  if (!process.env.REDIS_URL) return null;
  if (!redis) {
    const opts = getRedisConnectionOptions({ maxRetriesPerRequest: 1 });
    redis = new IORedis({ ...opts, connectTimeout: 3000, commandTimeout: 2000 });
    redis.on("error", (err) => console.warn("[rate-limit] Redis error:", err.message));
  }
  return redis;
}

function memoryHit(key: string, limit: number, windowSeconds: number, now: number): RateLimitResult {
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    if (memoryBuckets.size > 10_000) {
      for (const [k, v] of memoryBuckets) if (v.resetAt <= now) memoryBuckets.delete(k);
    }
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
  return { ok: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), retryAfterSeconds };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  store: Store = "shared"
): Promise<RateLimitResult> {
  const now = Date.now();
  const client = store === "shared" ? getRedis() : null;
  if (client) {
    try {
      const redisKey = `ratelimit:${key}`;
      const count = await client.incr(redisKey);
      if (count === 1) await client.expire(redisKey, windowSeconds);
      const ttl = await client.ttl(redisKey);
      return {
        ok: count <= limit,
        remaining: Math.max(0, limit - count),
        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
      };
    } catch (err) {
      console.warn("[rate-limit] Falling back to memory:", err instanceof Error ? err.message : err);
    }
  }
  return memoryHit(key, limit, windowSeconds, now);
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Test hook. */
export function resetMemoryRateLimits(): void {
  memoryBuckets.clear();
}
