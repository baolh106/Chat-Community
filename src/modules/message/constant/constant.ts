export const ResponseMessage = {
  CREATE_MESSAGE_FAILED: "Create message failed",
  CREATE_MESSAGE_SUCCESSFUL: "Create message successful",
  GET_MESSAGES_SUCCESSFUL: "Get messages successful",
  MARK_READ_SUCCESSFUL: "Mark read successful",
  GET_UNREAD_COUNT_SUCCESSFUL: "Get unread count successful",
};

export const ResponseCode = {
  CREATE_MESSAGE_FAILED: "CREATE_MESSAGE_FAILED",
  CREATE_MESSAGE_SUCCESSFUL: "CREATE_MESSAGE_SUCCESSFUL",
};

export const MessageSession = {
  CACHE_KEY_PREFIX: "message.session.v2",
  DISCONNECT_TIMEOUT_MS: 30000,
  CACHE_TTL_SECONDS: 24 * 60 * 60,
};

export const MessageLimits = {
  CONTENT_MAX_LENGTH: 4000,
  INSERT_LIST_MAX_ITEMS: 100,
  FILE_NAME_MAX_LENGTH: 255,
};

export const ALLOWED_UPLOAD_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/mp4",
  "audio/mpeg",
]);

export const SocketMessageError = {
  UNAUTHORIZED: "unauthorized",
  INVALID_PAYLOAD: "invalid_payload",
  RECEIVER_NOT_ALLOWED: "receiver_not_allowed",
  SERVICE_UNAVAILABLE: "message_service_unavailable",
  PERSIST_FAILED: "persist_failed",
  UPLOAD_FAILED: "upload_failed",
};
