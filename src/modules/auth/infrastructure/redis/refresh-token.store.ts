import type { RedisClient } from "../../../../infrastructure/redis";
import type { IRefreshTokenStore } from "../../application/ports/refresh-token-store.port";
import { CACHE_PREFIX } from "../../constants/constant";

export class RedisRefreshTokenStore implements IRefreshTokenStore {
  constructor(private readonly _redis: RedisClient) {}

  async save(principalId: string, token: string, ttlSeconds: number): Promise<void> {
    await this._redis.set(this.key(principalId), token, ttlSeconds);
  }

  async get(principalId: string): Promise<string | null> {
    return await this._redis.get(this.key(principalId));
  }

  async revoke(principalId: string): Promise<void> {
    await this._redis.del(this.key(principalId));
  }

  private key(principalId: string): string {
    return `${CACHE_PREFIX.REFRESH_TOKEN}:${principalId}`;
  }
}
