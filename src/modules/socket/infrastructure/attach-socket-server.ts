import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { applyRedisSocketAdapter } from "./redis.adapter";
import { registerSocketConnectionGateway } from "./socket-connection.gateway";
import { SocketRoomJoinRegistry } from "./socket-room.registry";

export type AttachSocketServerOptions = {
  adminJoinSecret: string;
  userJoinSecret: string;
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
    disposeRedis = await applyRedisSocketAdapter(
      io,
      options.redisUrl,
      key,
    );
    console.log("[SocketGateway] redis adapter enabled", { key });
  }

  const roomRegistry = new SocketRoomJoinRegistry();
  registerSocketConnectionGateway(
    io,
    {
      adminJoinSecret: options.adminJoinSecret,
      userJoinSecret: options.userJoinSecret,
    },
    roomRegistry,
  );

  return disposeRedis ? { io, disposeRedis } : { io };
}
