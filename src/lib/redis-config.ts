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
 * Parse REDIS_URL into connection options for BullMQ / ioredis.
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

  return {
    host,
    port,
    ...(parsed.username && { username: decodeURIComponent(parsed.username) }),
    ...(parsed.password && { password: decodeURIComponent(parsed.password) }),
    ...(useTls && { tls: { servername: host } }),
    ...overrides,
  };
}
