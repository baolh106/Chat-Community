import * as dotenv from "dotenv";
import { formatKey } from "../shared/utils/format";

const envFile = `.env.${process.env.NODE_ENV || "development"}`;
dotenv.config({ path: envFile });

// Nếu không có file env cụ thể cho NODE_ENV hiện tại, fallback về development.
if (process.env.NODE_ENV !== "development") {
  dotenv.config({ path: ".env.development" });
}

export const port = process.env.PORT || 4000;

/** Redis URL cho Socket.IO adapter. Để trống = chỉ adapter in-memory (một process). */
export const redisUrl = (process.env.REDIS_URL ?? "").trim();

/** Prefix pub/sub Redis cho Socket.IO (mặc định thư viện: `socket.io`). */
export const redisSocketIoKey = (process.env.REDIS_SOCKET_IO_KEY ?? "").trim();

/** Telegram Bot token và chat id để thông báo admin khi offline. */
export const telegramBotToken = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
export const telegramChatId = (process.env.TELEGRAM_CHAT_ID ?? "").trim();

/** RSA Keys cho JWT RS256 signing. */
export const privateKey = formatKey(process.env.PRIVATE_KEY);
export const publicKey = formatKey(process.env.PUBLIC_KEY);

/** JWT Config */
export const jwtAccessTokenExpiresIn =
  process.env.JWT_ACCESS_TOKEN_EXPIRES_IN ?? "15m";
export const jwtRefreshTokenExpiresIn =
  process.env.JWT_REFRESH_TOKEN_EXPIRES_IN ?? "7d";
