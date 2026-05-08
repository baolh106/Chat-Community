import type { Server as HttpServer } from "node:http";
import type { ISessionManager } from "../../../modules/message/application/session-manager.interface";
import type { IMessageApplication } from "../../../modules/message/application/message.application.interface";
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

export type { ISocketApplication } from "../application/socket.application.interface";
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
  sessionManager?: ISessionManager,
  messageApplication?: IMessageApplication,
): Promise<BootstrappedSocket> {
  const attached = await attachSocketServer(
    httpServer,
    options,
    sessionManager,
    messageApplication,
  );
  const socketService = new SocketApplication(attached.io);
  return { ...attached, socketService };
}
