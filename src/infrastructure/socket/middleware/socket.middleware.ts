import type { Socket } from "socket.io";
import {
  normalizeBearerToken,
  type ITokenVerifier,
} from "../../../shared/auth/auth-claims";
import { ErrorMessage } from "../../../shared/constants/error.constant";
import { UnauthorizedError } from "../../../shared/utils/error";
import type { SocketSessionData } from "../domain/socket-session.types";

export const createSocketAuthMiddleware =
  (verifier: ITokenVerifier) =>
  (socket: Socket, next: (err?: Error) => void): void => {
    const token = normalizeBearerToken(
      socket.handshake.auth?.token ?? socket.handshake.headers?.authorization,
    );
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

    const data: SocketSessionData = {
      ...(socket.data as SocketSessionData),
      role: result.claims.role,
    };
    if (result.claims.userId) data.userId = result.claims.userId;
    if (result.claims.nickname) data.nickname = result.claims.nickname;
    socket.data = data;
    next();
  };
