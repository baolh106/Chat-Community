import { Socket } from "socket.io";
import { UnauthorizedError } from "../../../shared/utils/error";

export const socketAuthMiddleware = (socket: Socket, next: (err?: any) => void) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

  if (!token) {
    return next(new UnauthorizedError("No token provided"));
  }

  try {
    next();
  } catch (error) {
    next(new UnauthorizedError("Invalid token"));
  }
};