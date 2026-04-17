import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";
import { publicKey } from "../../../config/env";
import { UnauthorizedError } from "../../../shared/utils/error";
import { ErrorMessage } from "../../../shared/constants/error.constant";

const normalizeAuthorizationToken = (rawToken: string): string => {
  const token = rawToken.trim();
  if (token.toLowerCase().startsWith("bearer ")) {
    return token.slice(7).trim();
  }
  return token;
};

export const socketAuthMiddleware = (
  socket: Socket,
  next: (err?: any) => void,
) => {
  const token =
    socket.handshake.auth?.token || socket.handshake.headers?.authorization;

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return next(new UnauthorizedError(ErrorMessage.TOKEN_REQUIRED));
  }

  const accessToken = normalizeAuthorizationToken(token);
  if (!accessToken) {
    return next(new UnauthorizedError(ErrorMessage.TOKEN_REQUIRED));
  }

  try {
    const payload = jwt.verify(accessToken, publicKey, {
      algorithms: ["RS256"],
    }) as Record<string, unknown>;

    if (!payload || typeof payload !== "object" || !payload.role) {
      return next(new UnauthorizedError(ErrorMessage.INVALID_TOKEN));
    }

    socket.data = {
      ...socket.data,
      role: payload.role,
      userId: typeof payload.userId === "string" ? payload.userId : undefined,
    };

    return next();
  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError(ErrorMessage.SESSION_EXPIRED));
    }

    return next(new UnauthorizedError(ErrorMessage.INVALID_TOKEN));
  }
};
