import {
  adminLoginMaxAttempts,
  adminLoginWindowSeconds,
} from "../../../config/env";
import type { RedisClient } from "../../../infrastructure/redis";
import type { IDbExecutor } from "../../../shared/database/db-executor.interface";
import { createRequireAuth } from "../../../shared/middleware/auth.middleware";
import { AuthAPI } from "../api/auth";
import { AuthApplication } from "../application/auth.application";
import { JwtAuthService } from "../infrastructure/jwt-auth.service";
import { AdminInfrastructure } from "../infrastructure/mongo/admin.infra";
import { RedisLoginRateLimiter } from "../infrastructure/redis/login-rate-limiter";
import { RedisRefreshTokenStore } from "../infrastructure/redis/refresh-token.store";

export const authModule = (dbExecutor: IDbExecutor, redis: RedisClient) => {
  const adminInfra = new AdminInfrastructure(dbExecutor);
  const tokenService = new JwtAuthService();
  const refreshTokenStore = new RedisRefreshTokenStore(redis);
  const loginLimiter = new RedisLoginRateLimiter(
    redis,
    adminLoginMaxAttempts,
    adminLoginWindowSeconds,
  );
  const authApp = new AuthApplication(
    adminInfra,
    tokenService,
    refreshTokenStore,
    loginLimiter,
  );
  const requireAuth = createRequireAuth(tokenService);
  const authApi = new AuthAPI(authApp, requireAuth);

  return {
    authApi,
    authApp,
    tokenVerifier: tokenService,
    requireAuth,
    refreshTokenStore,
  };
};
