import type { Server as HttpServer } from "node:http";
import { SocketApplication } from "../application/socket.application";
import {
  attachSocketServer,
  type AttachSocketServerOptions,
  type AttachedSocketServer,
} from "../infrastructure/attach-socket-server";

export {
  attachSocketServer,
  type AttachSocketServerOptions,
  type AttachedSocketServer,
} from "../infrastructure/attach-socket-server";

export type { ISocketService } from "../application/socket.application.interface";
export { ADMIN_ROOM, userRoom } from "../domain/room-name";
export type { SocketSessionData } from "../domain/socket-session.types";
export { SocketApplication } from "../application/socket.application";

export type BootstrappedSocket = AttachedSocketServer & {
  socketService: SocketApplication;
};

/** Composition root: HTTP server + cấu hình → `io` + `SocketApplication` + dispose Redis. */
export async function setupSocketServer(
  httpServer: HttpServer,
  options: AttachSocketServerOptions,
): Promise<BootstrappedSocket> {
  const attached = await attachSocketServer(httpServer, options);
  const socketService = new SocketApplication(attached.io);
  return { ...attached, socketService };
}
