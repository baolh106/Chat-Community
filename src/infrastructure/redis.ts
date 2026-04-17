import { createClient } from "redis";
import type { StringValue } from "ms";
import { redisUrl } from "../config/env";
import ms from "ms";

export class RedisClient {
  private readonly client: ReturnType<typeof createClient>;
  private connected = false;

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
      return ttl;
    }

    const parsed = ms(ttl as StringValue);
    if (typeof parsed !== "number" || Number.isNaN(parsed) || parsed <= 0) {
      return this.defaultTtlSeconds;
    }

    return Math.max(1, Math.floor(parsed / 1000));
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    await this.client.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await this.client.disconnect();
    this.connected = false;
  }

  async set(key: string, value: string, ttl?: string | number): Promise<void> {
    await this.connect();
    const expiresIn = this.parseTtl(ttl);
    await this.client.set(key, value, {
      EX: expiresIn,
    });
  }

  async get(key: string): Promise<string | null> {
    await this.connect();
    return this.client.get(key);
  }

  async del(key: string): Promise<number> {
    await this.connect();
    return this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    await this.connect();
    return (await this.client.exists(key)) > 0;
  }

  async ttl(key: string): Promise<number> {
    await this.connect();
    return this.client.ttl(key);
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
