import {
  jwtAccessTokenExpiresIn,
  jwtRefreshTokenExpiresIn,
  privateKey,
  publicKey,
} from "../../../config/env";
import jwt from "jsonwebtoken";
import ms from "ms";
import type { TokenResponse } from "../application/dtos/user-session.dto";

export class JwtAuthService {
  generateToken(payload: any): string {
    return jwt.sign(payload, privateKey, {
      algorithm: "RS256",
      expiresIn: jwtAccessTokenExpiresIn as ms.StringValue,
    });
  }

  generateRefreshToken(payload: any): string {
    return jwt.sign(payload, privateKey, {
      algorithm: "RS256",
      expiresIn: jwtRefreshTokenExpiresIn as ms.StringValue,
    });
  }

  verifyToken(token: string): boolean {
    try {
      jwt.verify(token, publicKey, { algorithms: ["RS256"] });
      return true;
    } catch (error) {
      return false;
    }
  }

  decodeToken(token: string): any {
    try {
      return jwt.verify(token, publicKey, { algorithms: ["RS256"] });
    } catch (error) {
      return {};
    }
  }

  generateAllToken(payload: any): TokenResponse {
    const accessToken = this.generateToken(payload);
    const refreshToken = this.generateRefreshToken(payload);
    const expiresIn = ms(jwtAccessTokenExpiresIn as ms.StringValue);
    return { accessToken, refreshToken, expiresIn };
  }
}
