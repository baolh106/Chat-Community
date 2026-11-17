import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { MessageCreate } from "../../../modules/message/application/dtos/param";
import type { IMessageApplication } from "../../../modules/message/application/message.application.interface";
import type { UploadFileInput } from "../../../modules/message/application/ports/file-storage.port";
import {
  MessageLimits,
  SocketMessageError,
} from "../../../modules/message/constant/constant";
import { ADMIN_PRINCIPAL, isAllowedReceiver } from "../../../shared/auth/auth-claims";
import { AppError } from "../../../shared/utils/error";
import { ADMIN_ROOM, userRoom } from "../domain/room-name";
import type { SocketSessionData } from "../domain/socket-session.types";

export type MessageSocket = {
  data: SocketSessionData;
  emit(event: string, payload: unknown): unknown;
  to(room: string): { emit(event: string, payload: unknown): unknown };
};

export type MessageSendHandlerDeps = {
  messageApp: IMessageApplication;
  maxFileSizeBytes: number;
  maxFilesPerMessage: number;
};

export type MessageSendHandler = (socket: MessageSocket, payload: unknown) => Promise<void>;

const fileSchema = z.object({
  data: z.string().min(1),
  name: z.string().trim().min(1).max(MessageLimits.FILE_NAME_MAX_LENGTH),
  mimeType: z.string().trim().min(1).max(255),
});

function buildSendSchema(maxFiles: number) {
  return z
    .object({
      receiver: z.string().trim().min(1).max(200),
      content: z.string().max(MessageLimits.CONTENT_MAX_LENGTH).nullish(),
      files: z.array(fileSchema).max(maxFiles).optional(),
    })
    .refine(
      (p) =>
        (typeof p.content === "string" && p.content.trim().length > 0) ||
        (p.files?.length ?? 0) > 0,
      { message: "message content or file is required" },
    );
}

function toWire(message: MessageCreate, tempId: string) {
  return {
    ...message,
    id: tempId,
    createdAt: message.createdAt.toISOString(),
    status: "sent",
  };
}

function clientReason(error: unknown, fallback: string): string {
  return error instanceof AppError && error.isOperational ? error.message : fallback;
}

function decodeFile(
  file: z.infer<typeof fileSchema>,
  maxFileSizeBytes: number,
): UploadFileInput {
  const base64 = file.data.includes(",") ? file.data.split(",").at(-1) ?? "" : file.data;
  if (Math.floor((base64.length * 3) / 4) > maxFileSizeBytes + 3) {
    throw new AppError(`File too large: ${file.name}`, 400, "BAD_REQUEST");
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new AppError(`Invalid file data: ${file.name}`, 400, "BAD_REQUEST");
  }
  return {
    buffer,
    originalName: file.name,
    mimeType: file.mimeType,
    size: buffer.length,
  };
}

export function createMessageSendHandler(deps: MessageSendHandlerDeps): MessageSendHandler {
  const schema = buildSendSchema(deps.maxFilesPerMessage);

  return async (socket, payload) => {
    const { role } = socket.data;
    const sender = role === "admin" ? ADMIN_PRINCIPAL : socket.data.userId;
    if (!role || !sender) {
      socket.emit("message:error", { ok: false, reason: SocketMessageError.UNAUTHORIZED });
      return;
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("message:error", {
        ok: false,
        reason: SocketMessageError.INVALID_PAYLOAD,
        detail: parsed.error.issues.map((i) => i.message).join("; "),
      });
      return;
    }
    const input = parsed.data;

    if (!isAllowedReceiver(role, input.receiver)) {
      socket.emit("message:error", { ok: false, reason: SocketMessageError.RECEIVER_NOT_ALLOWED });
      return;
    }

    const tempId = randomUUID();
    const message: MessageCreate = {
      id: tempId,
      sender,
      receiver: input.receiver,
      content: input.content && input.content.trim().length > 0 ? input.content : null,
      createdAt: new Date(),
    };
    const targetRoom = input.receiver === ADMIN_ROOM ? ADMIN_ROOM : userRoom(input.receiver);
    const files = input.files ?? [];

    if (files.length === 0) {
      const wire = toWire(message, tempId);
      socket.to(targetRoom).emit("message:new", wire);
      socket.emit("message:send:ack", { ok: true, tempId, message: wire });

      try {
        await deps.messageApp.create(message);
      } catch (error) {
        console.error("[SocketGateway] Message persist failed:", error);
        socket.emit("message:error", {
          ok: false,
          tempId,
          reason: clientReason(error, SocketMessageError.PERSIST_FAILED),
        });
      }
      return;
    }

    socket.emit("message:uploading", { tempId, count: files.length });
    try {
      const uploads = files.map((file) => decodeFile(file, deps.maxFileSizeBytes));
      const created = await deps.messageApp.createWithFiles(message, uploads);
      const wire = {
        ...toWire(created, tempId),
        hasAttachments: true,
        attachments: created.attachments ?? [],
      };

      socket.to(targetRoom).emit("message:new", wire);
      socket.emit("message:send:ack", { ok: true, tempId, message: wire });
    } catch (error) {
      console.error("[SocketGateway] message:send upload error:", error);
      const reason = clientReason(error, SocketMessageError.UPLOAD_FAILED);
      socket.emit("message:upload:error", { tempId, reason });
      socket.emit("message:error", { ok: false, tempId, reason });
    }
  };
}
