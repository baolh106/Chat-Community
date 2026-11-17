import jwt from "jsonwebtoken";
import ms from "ms";
import {
  jwtAccessTokenExpiresIn,
  jwtRefreshTokenExpiresIn,
  privateKey,
  publicKey,
} from "../../../config/env";
import type {
  AuthClaims,
  TokenType,
  TokenVerifyResult,
} from "../../../shared/auth/auth-claims";
import type { TokenResponse } from "../application/dtos/user-session.dto";
import type { ITokenService } from "../application/ports/token.port";

export type JwtAuthConfig = {
  privateKey: string;
  publicKey: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
};

const ALGORITHM = "RS256" as const;

export class JwtAuthService implements ITokenService {
  constructor(
    private readonly config: JwtAuthConfig = {
      privateKey,
      publicKey,
      accessTokenExpiresIn: jwtAccessTokenExpiresIn,
      refreshTokenExpiresIn: jwtRefreshTokenExpiresIn,
    },
  ) {}

  issue(claims: AuthClaims): TokenResponse {
    const accessToken = this.sign(claims, "access", this.config.accessTokenExpiresIn);
    const refreshToken = this.sign(claims, "refresh", this.config.refreshTokenExpiresIn);
    const expiresIn = ms(this.config.accessTokenExpiresIn as ms.StringValue);
    return { accessToken, refreshToken, expiresIn };
  }

  refreshTokenTtlSeconds(): number {
    return Math.max(
      1,
      Math.floor(ms(this.config.refreshTokenExpiresIn as ms.StringValue) / 1000),
    );
  }

  verify(token: string, expectedType: TokenType): TokenVerifyResult {
    let decoded: string | jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, this.config.publicKey, {
        algorithms: [ALGORITHM],
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { ok: false, reason: "expired" };
      }
      return { ok: false, reason: "invalid" };
    }

    if (typeof decoded !== "object" || decoded === null) {
      return { ok: false, reason: "invalid" };
    }
    if (decoded.type !== expectedType) {
      return { ok: false, reason: "invalid" };
    }

    const claims = this.toClaims(decoded);
    return claims ? { ok: true, claims } : { ok: false, reason: "invalid" };
  }

  private sign(claims: AuthClaims, type: TokenType, expiresIn: string): string {
    return jwt.sign({ ...claims, type }, this.config.privateKey, {
      algorithm: ALGORITHM,
      expiresIn: expiresIn as ms.StringValue,
    });
  }

  private toClaims(payload: jwt.JwtPayload): AuthClaims | null {
    if (payload.role === "admin") {
      return { role: "admin" };
    }
    if (payload.role === "user" && typeof payload.userId === "string" && payload.userId) {
      return {
        role: "user",
        userId: payload.userId,
        ...(typeof payload.nickname === "string" ? { nickname: payload.nickname } : {}),
      };
    }
    return null;
  }
}
