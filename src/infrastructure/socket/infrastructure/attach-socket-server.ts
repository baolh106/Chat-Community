import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { IMessageApplication } from "../../../modules/message/application/message.application.interface";
import type { ISessionManager } from "../../../modules/message/application/session-manager.interface";
import type { ITokenVerifier } from "../../../shared/auth/auth-claims";
import type { IEventBusPublisher } from "../../event-bus/application/event-bus-publisher.interface";
import { createSocketAuthMiddleware } from "../middleware/socket.middleware";
import { applyRedisSocketAdapter } from "./redis.adapter";
import { registerSocketCallSignalingGateway } from "./socket-call-signaling.gateway";
import { registerSocketConnectionGateway } from "./socket-connection.gateway";
import { createMessageSendHandler } from "./socket-message.handler";
import { SocketRoomJoinRegistry } from "./socket-room.registry";

export type AttachSocketServerOptions = {
  redisUrl?: string;
  redisKey?: string;
  corsOrigin: string[] | false | "*";
  maxHttpBufferSize: number;
  maxFileSizeBytes: number;
  maxFilesPerMessage: number;
};

export type SocketServerDependencies = {
  sessionManager: ISessionManager;
  messageApplication: IMessageApplication;
  eventBus: IEventBusPublisher;
  tokenVerifier: ITokenVerifier;
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
  const io = new Server(httpServer, {
    cors: { origin: options.corsOrigin },
    maxHttpBufferSize: options.maxHttpBufferSize,
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
  io.use(createSocketAuthMiddleware(deps.tokenVerifier));
  registerSocketConnectionGateway(io, roomRegistry, {
    sessionManager: deps.sessionManager,
    messageApp: deps.messageApplication,
    eventBus: deps.eventBus,
    onMessageSend: createMessageSendHandler({
      messageApp: deps.messageApplication,
      maxFileSizeBytes: options.maxFileSizeBytes,
      maxFilesPerMessage: options.maxFilesPerMessage,
    }),
  });
  registerSocketCallSignalingGateway(io, deps.eventBus);

  return disposeRedis ? { io, disposeRedis } : { io };
}
