import type { StringValue } from "ms";
import ms from "ms";
import { ROLE } from "../../../common/constants/constant";
import { jwtRefreshTokenExpiresIn } from "../../../config/env";
import { redisClient } from "../../../infrastructure/redis";
import { ErrorMessage } from "../../../shared/constants/error.constant";
import { BadRequestError } from "../../../shared/utils/error";
import { CACHE_PREFIX } from "../constants/constant";
import type { AdminInfrastructure } from "../infrastructure/surreal/admin.infra";
import type { JwtAuthService } from "../infrastructure/jwt-auth.service";
import type {
  TokenResponse,
  UserSessionStartRequest,
} from "./dtos/user-session.dto";
import type { IAuthApplication } from "./auth.application.interface";
import { UserJoinedEvent } from "../domain/events/user-joined.event";
import type { IEventBusPublisher } from "../../../infrastructure/event-bus/application/event-bus-publisher.interface";
import type { IAdminInfrastructure } from "../domain/admin.infra";

export class AuthApplication implements IAuthApplication {
  constructor(
    private readonly adminInfra: IAdminInfrastructure,
    private readonly jwtAuthService: JwtAuthService,
    private readonly eventBus: IEventBusPublisher,
  ) {}

  async startUserSession(req: UserSessionStartRequest): Promise<TokenResponse> {
    const nickname = req.nickname?.trim();
    if (nickname && nickname.length > 15) {
      throw new BadRequestError(ErrorMessage.NICKNAME_TOO_LONG);
    }
    const userId = `${nickname}_${Date.now()}`;

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

    const decoded = this.jwtAuthService.decodeToken(refreshToken);
    if (!decoded || !decoded.role) {
      throw new BadRequestError(ErrorMessage.UNAUTHORIZED);
    }

    const {
      exp,
      iat,
      nbf,
      jti,
      aud,
      iss,
      ...payload
    } = decoded as Record<string, unknown>;

    const cacheKey =
      payload.role === ROLE.ADMIN
        ? `${CACHE_PREFIX.REFRESH_TOKEN}:admin`
        : `${CACHE_PREFIX.REFRESH_TOKEN}:${payload.userId}`;

    const storedToken = await redisClient.get(cacheKey);
    if (!storedToken || storedToken !== refreshToken) {
      throw new BadRequestError(ErrorMessage.UNAUTHORIZED);
    }

    const token = this.jwtAuthService.generateAllToken(payload);
    const expiresInSeconds = ms(jwtRefreshTokenExpiresIn as StringValue);
    await redisClient.set(cacheKey, token.refreshToken, expiresInSeconds);

    return token;
  }
}
