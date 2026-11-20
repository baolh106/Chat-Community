import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  normalizeBearerToken,
  principalIdOf,
  type AuthClaims,
  type AuthRole,
  type ITokenVerifier,
} from "../auth/auth-claims";
import { ErrorMessage } from "../constants/error.constant";
import { addLogContext } from "../logging/log-context";
import { ForbiddenError, UnauthorizedError } from "../utils/error";

const AUTH_LOCALS_KEY = "auth";

export function createRequireAuth(verifier: ITokenVerifier): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = normalizeBearerToken(req.headers.authorization);
    if (!token) {
      next(new UnauthorizedError(ErrorMessage.TOKEN_REQUIRED));
      return;
    }

    const result = verifier.verify(token, "access");
    if (!result.ok) {
      next(
        new UnauthorizedError(
          result.reason === "expired"
            ? ErrorMessage.SESSION_EXPIRED
            : ErrorMessage.INVALID_TOKEN,
        ),
      );
      return;
    }

    res.locals[AUTH_LOCALS_KEY] = result.claims;
    addLogContext({ userId: principalIdOf(result.claims), role: result.claims.role });
    next();
  };
}

export function requireRole(role: AuthRole): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    const claims = res.locals[AUTH_LOCALS_KEY] as AuthClaims | undefined;
    if (!claims) {
      next(new UnauthorizedError(ErrorMessage.UNAUTHORIZED));
      return;
    }
    if (claims.role !== role) {
      next(new ForbiddenError(ErrorMessage.FORBIDDEN));
      return;
    }
    next();
  };
}

export function getAuth(res: Response): AuthClaims {
  const claims = res.locals[AUTH_LOCALS_KEY] as AuthClaims | undefined;
  if (!claims) {
    throw new UnauthorizedError(ErrorMessage.UNAUTHORIZED);
  }
  return claims;
}
