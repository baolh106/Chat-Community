import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { applyRedisSocketAdapter } from "./redis.adapter";
import { socketAuthMiddleware } from "../middleware/socket.middleware";
import { registerSocketConnectionGateway } from "./socket-connection.gateway";
import { registerSocketCallSignalingGateway } from "./socket-call-signaling.gateway";
// import { registerRemoteBrowserControlGateway } from "./remote-browser-control.gateway";
import { SocketRoomJoinRegistry } from "./socket-room.registry";
import type { ISessionManager } from "../../../modules/message/application/session-manager.interface";
import type { IMessageApplication } from "../../../modules/message/application/message.application.interface";
import type { IEventBusPublisher } from "../../event-bus/application/event-bus-publisher.interface";

export type AttachSocketServerOptions = {
  redisUrl?: string;
  redisKey?: string;
};

export type SocketServerDependencies = {
  sessionManager: ISessionManager;
  messageApplication: IMessageApplication;
  eventBus: IEventBusPublisher;
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
  deps: SocketServerDependencies,
): Promise<AttachedSocketServer> {
  const { sessionManager, messageApplication, eventBus } = deps;
  if (!sessionManager || !messageApplication || !eventBus) {
    throw new Error(
      "attachSocketServer requires sessionManager, messageApplication, and eventBus",
    );
  }
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
    roomRegistry,
    sessionManager,
    messageApplication,
    eventBus,
  );
  registerSocketCallSignalingGateway(io, eventBus);
  // registerRemoteBrowserControlGateway(io);

  return disposeRedis ? { io, disposeRedis } : { io };
}
