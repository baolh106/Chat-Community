import { Router } from "express";
import multer from "multer";
import type { IMessageApplication } from "../application/message.application.interface";
import { catchAsync } from "../../../shared/utils/catchAsync";
import type { MessageCreate } from "../application/dtos/param";
import { sendSuccess } from "../../../shared/utils/response";
import { ResponseMessage } from "../constant/constant";
import type { Request, Response } from "express";
import { uploadMaxFileSizeMb } from "../../../config/env";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: uploadMaxFileSizeMb * 1024 * 1024,
  },
});

export class MessageAPI {
  constructor(private readonly _messageApp: IMessageApplication) {}

  api() {
    const router = Router();
    router.post(
      "/insert",
      upload.single("file"),
      catchAsync(async (req: Request, res: Response) => {
        const payload = this.buildMessagePayload(req);
        if (req.file) {
          await this._messageApp.createWithFile(payload, {
            buffer: req.file.buffer,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
          });
        } else {
          await this._messageApp.create(payload);
        }
        sendSuccess(res, "", ResponseMessage.CREATE_MESSAGE_SUCCESSFUL);
      }),
    );

    router.post(
      "/insert-list",
      catchAsync(async (req: Request, res: Response) => {
        const payload = req.body as MessageCreate[];
        await this._messageApp.insertList(payload);
        sendSuccess(res, "", ResponseMessage.CREATE_MESSAGE_SUCCESSFUL);
      }),
    );

    router.get(
      "/list/:conversationKey",
      catchAsync(async (req: Request, res: Response) => {
        const { conversationKey } = req.params;
        const messages = await this._messageApp.getMessagesByUserId(
          String(conversationKey),
        );
        sendSuccess(res, messages, "Get messages successful");
      }),
    );

    router.post(
      "/mark-read",
      catchAsync(async (req: Request, res: Response) => {
        const body = req.body as { conversationKey?: string; readerId?: string };
        const conversationKey = String(body.conversationKey ?? "");
        const readerId = String(body.readerId ?? "");
        const updatedCount = await this._messageApp.markMessagesAsRead(
          conversationKey,
          readerId,
        );
        sendSuccess(res, { updatedCount }, "Mark read successful");
      }),
    );

    router.get(
      "/unread-count/:conversationKey",
      catchAsync(async (req: Request, res: Response) => {
        const { conversationKey } = req.params;
        const readerId = String(req.query.readerId ?? "");
        const count = await this._messageApp.getUnreadCount(
          String(conversationKey),
          readerId,
        );
        sendSuccess(res, { unreadCount: count }, "Get unread count successful");
      }),
    );

    return router;
  }

  private buildMessagePayload(req: Request): MessageCreate {
    const body = req.body as Partial<Record<keyof MessageCreate, unknown>>;
    const content =
      typeof body.content === "string" && body.content.length > 0
        ? body.content
        : null;
    const createdAt =
      typeof body.createdAt === "string" || body.createdAt instanceof Date
        ? new Date(body.createdAt)
        : new Date();
    const payload: MessageCreate = {
      content,
      createdAt,
      sender: String(body.sender ?? ""),
      receiver: String(body.receiver ?? ""),
    };

    if (typeof body.imageURL === "string") payload.imageURL = body.imageURL;
    if (typeof body.fileURL === "string") payload.fileURL = body.fileURL;
    if (typeof body.fileDownloadURL === "string") {
      payload.fileDownloadURL = body.fileDownloadURL;
    }
    if (typeof body.fileName === "string") payload.fileName = body.fileName;
    if (typeof body.fileMimeType === "string") {
      payload.fileMimeType = body.fileMimeType;
    }
    if (typeof body.fileDriveId === "string") {
      payload.fileDriveId = body.fileDriveId;
    }
    if (body.attachmentType === "image" || body.attachmentType === "file") {
      payload.attachmentType = body.attachmentType;
    }
    if (
      typeof body.fileSize === "string" ||
      typeof body.fileSize === "number"
    ) {
      const fileSize = Number(body.fileSize);
      if (!Number.isNaN(fileSize)) payload.fileSize = fileSize;
    }

    return payload;
  }
}
