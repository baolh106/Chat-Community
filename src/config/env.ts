import * as dotenv from "dotenv";

dotenv.config({ path: `.env.${process.env.NODE_ENV || "development"}` });

export const port = process.env.PORT || 4000;

/** Secret gửi kèm sự kiện socket `admin:join` để vào room nhận push tin nhắn mới. */
export const adminSocketSecret = process.env.ADMIN_SOCKET_SECRET ?? "";

/** Secret cho `user:join` — user gửi `{ userId, token }` để vào room `user:${userId}`. */
export const userSocketSecret = process.env.USER_SOCKET_SECRET ?? "";

/** Redis URL cho Socket.IO adapter. Để trống = chỉ adapter in-memory (một process). */
export const redisUrl = (process.env.REDIS_URL ?? "").trim();

/** Prefix pub/sub Redis cho Socket.IO (mặc định thư viện: `socket.io`). */
export const redisSocketIoKey = (process.env.REDIS_SOCKET_IO_KEY ?? "").trim();
