import { ROLE } from "../../../common/constants/constant";
import {
  ADMIN_PRINCIPAL,
  principalIdOf,
  type AuthClaims,
} from "../../../shared/auth/auth-claims";
import { ErrorMessage } from "../../../shared/constants/error.constant";
import {
  BadRequestError,
  TooManyRequestError,
  UnauthorizedError,
} from "../../../shared/utils/error";
import { NICKNAME_MAX_LENGTH } from "../constants/constant";
import type { IAdminInfrastructure } from "../domain/admin.infra";
import type { IAuthApplication } from "./auth.application.interface";
import type {
  TokenResponse,
  UserSessionStartRequest,
} from "./dtos/user-session.dto";
import type { ILoginRateLimiter } from "./ports/login-rate-limiter.port";
import type { IRefreshTokenStore } from "./ports/refresh-token-store.port";
import type { ITokenService } from "./ports/token.port";

export class AuthApplication implements IAuthApplication {
  constructor(
    private readonly _adminInfra: IAdminInfrastructure,
    private readonly _tokens: ITokenService,
    private readonly _refreshStore: IRefreshTokenStore,
    private readonly _loginLimiter: ILoginRateLimiter,
  ) {}

  async startUserSession(req: UserSessionStartRequest): Promise<TokenResponse> {
    const nickname = req.nickname?.trim() ?? "";
    if (nickname.length === 0) {
      throw new BadRequestError(ErrorMessage.NICKNAME_REQUIRED);
    }
    if (nickname.length > NICKNAME_MAX_LENGTH) {
      throw new BadRequestError(ErrorMessage.NICKNAME_TOO_LONG);
    }

    const userId = `${nickname}_${Date.now()}`;
    return await this.issueAndStore({ role: ROLE.USER, userId, nickname }, userId);
  }

  async endUserSession(claims: AuthClaims): Promise<void> {
    const principalId = principalIdOf(claims);
    if (!principalId) {
      throw new UnauthorizedError(ErrorMessage.UNAUTHORIZED);
    }
    await this._refreshStore.revoke(principalId);
  }

  async loginAdmin(password: string, clientKey: string): Promise<TokenResponse> {
    if (!password) {
      throw new BadRequestError(ErrorMessage.PASSWORD_REQUIRED);
    }

    const decision = await this._loginLimiter.consume(clientKey);
    if (!decision.allowed) {
      throw new TooManyRequestError(
        `${ErrorMessage.TOO_MANY_LOGIN_ATTEMPTS} (retry after ${decision.retryAfterSeconds}s)`,
      );
    }

    const isValid = await this._adminInfra.verifyPassword(password);
    if (!isValid) {
      throw new UnauthorizedError(ErrorMessage.UNAUTHORIZED);
    }

    await this._loginLimiter.reset(clientKey);
    return await this.issueAndStore({ role: ROLE.ADMIN }, ADMIN_PRINCIPAL);
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const result = this._tokens.verify(refreshToken, "refresh");
    if (!result.ok) {
      throw new UnauthorizedError(ErrorMessage.UNAUTHORIZED);
    }

    const principalId = principalIdOf(result.claims);
    if (!principalId) {
      throw new UnauthorizedError(ErrorMessage.UNAUTHORIZED);
    }

    const storedToken = await this._refreshStore.get(principalId);
    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedError(ErrorMessage.UNAUTHORIZED);
    }

    return await this.issueAndStore(result.claims, principalId);
  }

  private async issueAndStore(
    claims: AuthClaims,
    principalId: string,
  ): Promise<TokenResponse> {
    const token = this._tokens.issue(claims);
    await this._refreshStore.save(
      principalId,
      token.refreshToken,
      this._tokens.refreshTokenTtlSeconds(),
    );
    return token;
  }
}
