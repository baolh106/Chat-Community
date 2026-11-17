import type { Server as HttpServer } from "node:http";
import { SocketApplication } from "../application/socket.application";
import {
  attachSocketServer,
  type AttachSocketServerOptions,
  type AttachedSocketServer,
  type SocketServerDependencies,
} from "../infrastructure/attach-socket-server";

export {
  attachSocketServer,
  type AttachSocketServerOptions,
  type AttachedSocketServer,
  type SocketServerDependencies,
} from "../infrastructure/attach-socket-server";

export type { ISocketApplication } from "../application/socket.application.interface";
export { ADMIN_ROOM, userRoom } from "../domain/room-name";
export type { SocketSessionData } from "../domain/socket-session.types";
export { SocketApplication } from "../application/socket.application";

export type BootstrappedSocket = AttachedSocketServer & {
  socketService: SocketApplication;
  close: () => Promise<void>;
};

export async function setupSocketServer(
  httpServer: HttpServer,
  options: AttachSocketServerOptions,
  deps: SocketServerDependencies,
): Promise<BootstrappedSocket> {
  const attached = await attachSocketServer(httpServer, options, deps);
  const socketService = new SocketApplication(attached.io);

  const close = async () => {
    attached.io.disconnectSockets(true);
    await attached.disposeRedis?.();
  };

  return { ...attached, socketService, close };
}
