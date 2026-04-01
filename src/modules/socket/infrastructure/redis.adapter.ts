import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import type { Server } from "socket.io";

/**
 * Gắn Redis pub/sub adapter cho Socket.IO (scale nhiều instance).
 */
export async function applyRedisSocketAdapter(
  io: Server,
  redisUrl: string,
  key: string = "socket.io",
): Promise<() => Promise<void>> {
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  io.adapter(createAdapter(pubClient, subClient, { key }));

  return async () => {
    await subClient.quit().catch(() => {});
    await pubClient.quit().catch(() => {});
  };
}
