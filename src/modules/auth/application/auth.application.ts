import type { StringValue } from "ms";
import ms from "ms";
import { ROLE } from "../../../common/constants/constant";
import { jwtRefreshTokenExpiresIn } from "../../../config/env";
import { redisClient } from "../../../infrastructure/redis";
import { ErrorMessage } from "../../../shared/constants/error.constant";
import { BadRequestError } from "../../../shared/utils/error";
import { CACHE_PREFIX } from "../constants/constant";
import type { AdminInfrastructure } from "../infrastructure/admin.infra";
import type { JwtAuthService } from "../infrastructure/jwt-auth.service";
import type {
  TokenResponse,
  UserSessionStartRequest,
} from "./dtos/user-session.dto";
import type { IAuthApplication } from "./auth.application.interface";

export class AuthApplication implements IAuthApplication {
  constructor(
    private readonly adminInfra: AdminInfrastructure,
    private readonly jwtAuthService: JwtAuthService,
  ) {}

  async startUserSession(req: UserSessionStartRequest): Promise<TokenResponse> {
    const nickname = req.nickname?.trim();
    const userId = `${nickname}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const payload = {
      role: ROLE.USER,
      userId,
      nickname,
    };

    const token = this.jwtAuthService.generateAllToken(payload);

    // save refresh token to Redis with expiration
    const expiresInSeconds = ms(jwtRefreshTokenExpiresIn as StringValue);
    await redisClient.set(
      `${CACHE_PREFIX.REFRESH_TOKEN}:${userId}`,
      token.refreshToken,
      expiresInSeconds,
    );

    return token;
  }

  async endUserSession(userId: string): Promise<void> {
    await redisClient.del(`${CACHE_PREFIX.REFRESH_TOKEN}:${userId}`);
  }

  async loginAdmin(password: string): Promise<TokenResponse> {
    if (!password) {
      throw new BadRequestError(ErrorMessage.PASSWORD_REQUIRED);
    }

    const isValid = await this.adminInfra.verifyPassword(password);
    if (!isValid) {
      throw new BadRequestError(ErrorMessage.UNAUTHORIZED);
    }

    const payload = { role: ROLE.ADMIN };
    const token = this.jwtAuthService.generateAllToken(payload);

    // save refresh token to Redis with expiration
    const expiresInSeconds = ms(jwtRefreshTokenExpiresIn as StringValue);
    await redisClient.set(
      `${CACHE_PREFIX.REFRESH_TOKEN}:admin`,
      token.refreshToken,
      expiresInSeconds,
    );

    return token;
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const isValid = await this.jwtAuthService.verifyToken(refreshToken);
    if (!isValid) {
      throw new BadRequestError(ErrorMessage.UNAUTHORIZED);
    }

    const payload = this.jwtAuthService.decodeToken(refreshToken);

    return this.jwtAuthService.generateAllToken(payload);
  }
}
