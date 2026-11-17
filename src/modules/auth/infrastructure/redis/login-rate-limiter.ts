import type { RedisClient } from "../../../../infrastructure/redis";
import type {
  ILoginRateLimiter,
  RateLimitDecision,
} from "../../application/ports/login-rate-limiter.port";
import { CACHE_PREFIX } from "../../constants/constant";

export class RedisLoginRateLimiter implements ILoginRateLimiter {
  constructor(
    private readonly _redis: RedisClient,
    private readonly _maxAttempts: number,
    private readonly _windowSeconds: number,
  ) {}

  async consume(key: string): Promise<RateLimitDecision> {
    try {
      const { count, ttlSeconds } = await this._redis.incrWithTtl(
        this.key(key),
        this._windowSeconds,
      );
      return {
        allowed: count <= this._maxAttempts,
        retryAfterSeconds: ttlSeconds > 0 ? ttlSeconds : this._windowSeconds,
      };
    } catch (error) {
      console.error("[RedisLoginRateLimiter] Redis unavailable, failing open:", error);
      return { allowed: true, retryAfterSeconds: 0 };
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this._redis.del(this.key(key));
    } catch (error) {
      console.error("[RedisLoginRateLimiter] Failed to reset counter:", error);
    }
  }

  private key(key: string): string {
    return `${CACHE_PREFIX.LOGIN_ATTEMPT}:${key}`;
  }
}
