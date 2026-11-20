import * as dotenv from "dotenv";
import { formatKey } from "../shared/utils/format";

dotenv.config();

export const port = process.env.PORT || 3000;

const rawRedisUrl = (process.env.REDIS_URL ?? "").trim();
const redisHost = (process.env.REDIS_HOST ?? "localhost").trim();
const redisPort = (process.env.REDIS_PORT ?? "6379").trim();
const redisPassword = (process.env.REDIS_PASSWORD ?? "").trim();
const redisUsername = (process.env.REDIS_USERNAME ?? "").trim();

function buildRedisUrl(): string {
  if (rawRedisUrl.length > 0) {
    return rawRedisUrl;
  }

  if (!redisHost || !redisPort) {
    return "";
  }

  let auth = "";
  if (redisPassword || redisUsername) {
    const encodedUsername = encodeURIComponent(redisUsername);
    const encodedPassword = encodeURIComponent(redisPassword);
    if (redisUsername && redisPassword) {
      auth = `${encodedUsername}:${encodedPassword}@`;
    } else if (redisPassword) {
      auth = `:${encodedPassword}@`;
    } else {
      auth = `${encodedUsername}@`;
    }
  }

  return `redis://${auth}${redisHost}:${redisPort}`;
}

/** Redis URL cho Socket.IO adapter. Để trống = chỉ adapter in-memory (một process). */
export const redisUrl = buildRedisUrl();

/** Prefix pub/sub Redis cho Socket.IO (mặc định thư viện: `socket.io`). */
export const redisSocketIoKey = (process.env.REDIS_SOCKET_IO_KEY ?? "").trim();

/** Telegram Bot token và chat id để thông báo admin khi offline. */
export const telegramBotToken = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
export const telegramChatId = (process.env.TELEGRAM_CHAT_ID ?? "").trim();
export const telegramAppId = (process.env.TELEGRAM_APP_ID ?? "").trim();
export const telegramAppHash = (process.env.TELEGRAM_APP_HASH ?? "").trim();
export const telegramHelperSession = (formatKey(process.env.TELEGRAM_HELPER_SESSION) ?? "").trim();

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

export const uploadMaxFilesPerMessage = positiveInt(
  process.env.UPLOAD_MAX_FILES_PER_MESSAGE,
  5,
);

export const socketMaxHttpBufferBytes = (() => {
  const fromEnv = Number(process.env.SOCKET_MAX_PAYLOAD_MB);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.floor(fromEnv * 1024 * 1024);
  }
  return Math.ceil((uploadMaxFileSizeMb * 1024 * 1024 * 4) / 3) + 1024 * 1024;
})();

export const nodeEnv = process.env.NODE_ENV ?? "development";
export const isProduction = nodeEnv === "production";
export const isTest = nodeEnv === "test";
export const corsOrigin = (process.env.CORS_ORIGIN ?? "").trim();

export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const logLevel: LogLevel = (() => {
  if (isTest) return "silent";
  const raw = (process.env.LOG_LEVEL ?? "").trim().toLowerCase();
  const known = LOG_LEVELS.find((level) => level === raw);
  if (known) return known;
  return isProduction ? "info" : "debug";
})();

export const logPretty =
  !isProduction && !isTest && (process.env.LOG_PRETTY ?? "").trim().toLowerCase() === "true";

export const serviceName = (process.env.APP_NAME ?? "").trim() || "chat-community";

export const corsAllowedOrigins: string[] | false | "*" = isProduction
  ? corsOrigin.length > 0
    ? corsOrigin.split(",").map((item) => item.trim()).filter(Boolean)
    : false
  : "*";

export const trustProxy: boolean | number | string = (() => {
  const raw = (process.env.TRUST_PROXY ?? "").trim();
  if (raw === "" || raw === "false") return false;
  if (raw === "true") return true;
  const asNumber = Number(raw);
  return Number.isInteger(asNumber) ? asNumber : raw;
})();

export const mongoDnsServers = (process.env.MONGO_DNS_SERVERS ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

export const adminLoginMaxAttempts = positiveInt(
  process.env.ADMIN_LOGIN_MAX_ATTEMPTS,
  5,
);
export const adminLoginWindowSeconds = positiveInt(
  process.env.ADMIN_LOGIN_WINDOW_SECONDS,
  15 * 60,
);

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** RSA Keys cho JWT RS256 signing. */
export const privateKey = formatKey(process.env.PRIVATE_KEY);
export const publicKey = formatKey(process.env.PUBLIC_KEY);

/** JWT Config */
export const jwtAccessTokenExpiresIn =
  process.env.JWT_ACCESS_TOKEN_EXPIRES_IN ?? "15m";
export const jwtRefreshTokenExpiresIn =
  process.env.JWT_REFRESH_TOKEN_EXPIRES_IN ?? "7d";

/** Image Detector Service AI */
export const detectorServiceUrl = (process.env.IMAGE_DETECTOR_SERVICE_URL ?? "").trim();
export const imageDetectorApiKey = (process.env.API_KEY_IMAGE_DETECTOR_SERVICE ?? "").trim();
