import type { RedisClient } from "../../../../infrastructure/redis";
import type {
  ILoginRateLimiter,
  RateLimitDecision,
} from "../../application/ports/login-rate-limiter.port";
import { CACHE_PREFIX } from "../../constants/constant";
import { createLogger } from "../../../../shared/logging/logger";

const logger = createLogger("login-rate-limiter");

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
      logger.error("redis unavailable, failing open", { err: error });
      return { allowed: true, retryAfterSeconds: 0 };
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this._redis.del(this.key(key));
    } catch (error) {
      logger.warn("failed to reset login counter", { err: error });
    }
  }

  private key(key: string): string {
    return `${CACHE_PREFIX.LOGIN_ATTEMPT}:${key}`;
  }
}
