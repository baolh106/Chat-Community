import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { applyRedisSocketAdapter } from "./redis.adapter";
import { socketAuthMiddleware } from "../middleware/socket.middleware";
import { registerSocketConnectionGateway } from "./socket-connection.gateway";
import { SocketRoomJoinRegistry } from "./socket-room.registry";
import type { ISessionManager } from "../../../modules/message/application/session-manager.interface";
import type { IMessageApplication } from "../../../modules/message/application/message.application.interface";

export type AttachSocketServerOptions = {
  redisUrl?: string;
  redisKey?: string;
};

export type AttachedSocketServer = {
  io: Server;
  disposeRedis?: () => Promise<void>;
};

/**
 * Khởi tạo Socket.IO, tuỳ chọn Redis adapter, gắn gateway (join room + log).
 */
export async function attachSocketServer(
  httpServer: HttpServer,
  options: AttachSocketServerOptions,
  sessionManager?: ISessionManager,
  messageApplication?: IMessageApplication,
): Promise<AttachedSocketServer> {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  let disposeRedis: (() => Promise<void>) | undefined;
  if (options.redisUrl) {
    const key =
      options.redisKey && options.redisKey.length > 0
        ? options.redisKey
        : "socket.io";
    disposeRedis = await applyRedisSocketAdapter(io, options.redisUrl, key);
    console.log("[SocketGateway] redis adapter enabled", { key });
  }

  const roomRegistry = new SocketRoomJoinRegistry();
  io.use(socketAuthMiddleware);
  registerSocketConnectionGateway(
    io,
    {},
    roomRegistry,
    sessionManager,
    messageApplication,
  );

  return disposeRedis ? { io, disposeRedis } : { io };
}
