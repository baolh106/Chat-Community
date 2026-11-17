import { createClient } from "redis";
import type { StringValue } from "ms";
import { redisUrl } from "../config/env";
import ms from "ms";

const INCR_WITH_TTL_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return { count, redis.call('TTL', KEYS[1]) }
`;

export class RedisClient {
  private readonly client: ReturnType<typeof createClient>;
  private connecting: Promise<void> | null = null;

  constructor(
    url: string = redisUrl,
    private readonly defaultTtlSeconds = Math.max(
      1,
      Math.floor(ms("1h") / 1000),
    ),
  ) {
    this.client = url ? createClient({ url }) : createClient();
    this.client.on("error", (error) => {
      console.error("[RedisClient] Redis error:", error);
    });
  }

  private parseTtl(ttl?: string | number): number {
    if (ttl === undefined || ttl === null) {
      return this.defaultTtlSeconds;
    }

    if (typeof ttl === "number") {
      return Math.max(1, Math.floor(ttl));
    }

    const parsed = ms(ttl as StringValue);
    if (typeof parsed !== "number" || Number.isNaN(parsed) || parsed <= 0) {
      return this.defaultTtlSeconds;
    }

    return Math.max(1, Math.floor(parsed / 1000));
  }

  async connect(): Promise<void> {
    if (this.client.isOpen) {
      return;
    }
    if (!this.connecting) {
      this.connecting = this.client
        .connect()
        .then(() => undefined)
        .finally(() => {
          this.connecting = null;
        });
    }
    await this.connecting;
  }

  async disconnect(): Promise<void> {
    if (!this.client.isOpen) {
      return;
    }
    await this.client.close();
  }

  async set(key: string, value: string, ttl?: string | number): Promise<void> {
    await this.connect();
    await this.client.set(key, value, {
      EX: this.parseTtl(ttl),
    });
  }

  async get(key: string): Promise<string | null> {
    await this.connect();
    return this.client.get(key);
  }

  async del(...keys: string[]): Promise<number> {
    await this.connect();
    return this.client.del(keys);
  }

  async exists(key: string): Promise<boolean> {
    await this.connect();
    return (await this.client.exists(key)) > 0;
  }

  async ttl(key: string): Promise<number> {
    await this.connect();
    return this.client.ttl(key);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    await this.connect();
    return this.client.lRange(key, start, stop);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    await this.connect();
    return (await this.client.hGetAll(key)) as Record<string, string>;
  }

  async eval(
    script: string,
    keys: string[],
    args: Array<string | number>,
  ): Promise<unknown> {
    await this.connect();
    return this.client.eval(script, {
      keys,
      arguments: args.map(String),
    });
  }

  async incrWithTtl(
    key: string,
    ttl: string | number,
  ): Promise<{ count: number; ttlSeconds: number }> {
    const result = (await this.eval(INCR_WITH_TTL_SCRIPT, [key], [
      this.parseTtl(ttl),
    ])) as [number, number];
    return { count: Number(result[0]), ttlSeconds: Number(result[1]) };
  }

  async setJson<T>(
    key: string,
    value: T,
    ttl?: string | number,
  ): Promise<void> {
    await this.set(key, JSON.stringify(value), ttl);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const payload = await this.get(key);
    if (!payload) {
      return null;
    }

    try {
      return JSON.parse(payload) as T;
    } catch (error) {
      console.error(
        "[RedisClient] Failed to parse JSON from Redis key",
        key,
        error,
      );
      return null;
    }
  }
}

export const redisClient = new RedisClient();
