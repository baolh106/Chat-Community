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

/** Google Drive storage cho upload file tạm thời. */
export const googleDriveFolderId = (
  process.env.GOOGLE_DRIVE_FOLDER_ID ?? ""
).trim();
export const googleDriveServiceAccountEmail = (
  process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL ?? ""
).trim();
export const googleDrivePrivateKey = formatKey((
  process.env.GOOGLE_DRIVE_PRIVATE_KEY ?? ""
).trim());
export const googleDriveOAuthClientId = (
  process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID ?? ""
).trim();
export const googleDriveOAuthClientSecret = (
  process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET ?? ""
).trim();
export const googleDriveOAuthRefreshToken = (
  process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN ?? ""
).trim();
export const googleDriveServiceAccountJson = (() => {
  const raw = (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("{")) return raw;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return decoded.trim().startsWith("{") ? decoded : raw;
  } catch {
    return raw;
  }
})();
export const googleDriveMakePublic =
  (process.env.GOOGLE_DRIVE_MAKE_PUBLIC ?? "true").toLowerCase() !== "false";
export const uploadMaxFileSizeMb = Number(
  process.env.UPLOAD_MAX_FILE_SIZE_MB ?? 10,
);

/** RSA Keys cho JWT RS256 signing. */
export const privateKey = formatKey(process.env.PRIVATE_KEY);
export const publicKey = formatKey(process.env.PUBLIC_KEY);

/** JWT Config */
export const jwtAccessTokenExpiresIn =
  process.env.JWT_ACCESS_TOKEN_EXPIRES_IN ?? "15m";
export const jwtRefreshTokenExpiresIn =
  process.env.JWT_REFRESH_TOKEN_EXPIRES_IN ?? "7d";
