import type { Request, RequestHandler, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import {
  canAccessConversation,
  isAllowedReceiver,
  principalIdOf,
  type AuthClaims,
} from "../../../shared/auth/auth-claims";
import { ErrorMessage } from "../../../shared/constants/error.constant";
import { getAuth } from "../../../shared/middleware/auth.middleware";
import { catchAsync } from "../../../shared/utils/catchAsync";
import { ForbiddenError, UnauthorizedError } from "../../../shared/utils/error";
import { sendSuccess } from "../../../shared/utils/response";
import { parseInput } from "../../../shared/utils/validate";
import type { MessageCreate } from "../application/dtos/param";
import type { IMessageApplication } from "../application/message.application.interface";
import type { UploadFileInput } from "../application/ports/file-storage.port";
import { MessageLimits, ResponseMessage } from "../constant/constant";

export type MessageApiOptions = {
  maxFileSizeBytes: number;
  maxFilesPerMessage: number;
};

const receiverSchema = z.string().trim().min(1).max(200);
const contentSchema = z
  .string()
  .max(MessageLimits.CONTENT_MAX_LENGTH)
  .nullish()
  .transform((value) => (value && value.trim().length > 0 ? value : null));

const insertBodySchema = z.object({
  receiver: receiverSchema,
  content: contentSchema,
});

const insertListSchema = z
  .array(insertBodySchema)
  .min(1)
  .max(MessageLimits.INSERT_LIST_MAX_ITEMS);

const conversationParamsSchema = z.object({
  conversationKey: z.string().trim().min(1).max(200),
});

const markReadBodySchema = z.object({
  conversationKey: z.string().trim().min(1).max(200),
});

export class MessageAPI {
  private readonly upload: multer.Multer;

  constructor(
    private readonly _messageApp: IMessageApplication,
    private readonly _requireAuth: RequestHandler,
    private readonly _options: MessageApiOptions,
  ) {
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: _options.maxFileSizeBytes,
        files: _options.maxFilesPerMessage,
      },
    });
  }

  api() {
    const router = Router();
    router.use(this._requireAuth);

    router.post(
      "/insert",
      this.upload.fields([
        { name: "file", maxCount: 1 },
        { name: "files", maxCount: this._options.maxFilesPerMessage },
      ]),
      catchAsync(async (req: Request, res: Response) => {
        const claims = getAuth(res);
        const body = parseInput(insertBodySchema, req.body);
        const message = this.buildMessage(claims, body.receiver, body.content);
        const files = this.collectFiles(req);

        const created =
          files.length > 0
            ? await this._messageApp.createWithFiles(message, files)
            : await this._messageApp.create(message);
        sendSuccess(res, created, ResponseMessage.CREATE_MESSAGE_SUCCESSFUL);
      }),
    );

    router.post(
      "/insert-list",
      catchAsync(async (req: Request, res: Response) => {
        const claims = getAuth(res);
        const items = parseInput(insertListSchema, req.body);
        const messages = items.map((item) =>
          this.buildMessage(claims, item.receiver, item.content),
        );
        await this._messageApp.insertList(messages);
        sendSuccess(res, "", ResponseMessage.CREATE_MESSAGE_SUCCESSFUL);
      }),
    );

    router.get(
      "/list/:conversationKey",
      catchAsync(async (req: Request, res: Response) => {
        const { conversationKey } = parseInput(conversationParamsSchema, req.params);
        this.assertConversationAccess(getAuth(res), conversationKey);
        const messages = await this._messageApp.getMessages(conversationKey);
        sendSuccess(res, messages, ResponseMessage.GET_MESSAGES_SUCCESSFUL);
      }),
    );

    router.post(
      "/mark-read",
      catchAsync(async (req: Request, res: Response) => {
        const claims = getAuth(res);
        const { conversationKey } = parseInput(markReadBodySchema, req.body);
        this.assertConversationAccess(claims, conversationKey);
        const updatedCount = await this._messageApp.markMessagesAsRead(
          conversationKey,
          this.principalOrThrow(claims),
        );
        sendSuccess(res, { updatedCount }, ResponseMessage.MARK_READ_SUCCESSFUL);
      }),
    );

    router.get(
      "/unread-count/:conversationKey",
      catchAsync(async (req: Request, res: Response) => {
        const claims = getAuth(res);
        const { conversationKey } = parseInput(conversationParamsSchema, req.params);
        this.assertConversationAccess(claims, conversationKey);
        const count = await this._messageApp.getUnreadCount(
          conversationKey,
          this.principalOrThrow(claims),
        );
        sendSuccess(res, { unreadCount: count }, ResponseMessage.GET_UNREAD_COUNT_SUCCESSFUL);
      }),
    );

    return router;
  }

  private buildMessage(
    claims: AuthClaims,
    receiver: string,
    content: string | null,
  ): MessageCreate {
    if (!isAllowedReceiver(claims.role, receiver)) {
      throw new ForbiddenError(ErrorMessage.RECEIVER_NOT_ALLOWED);
    }
    return {
      sender: this.principalOrThrow(claims),
      receiver,
      content,
      createdAt: new Date(),
    };
  }

  private principalOrThrow(claims: AuthClaims): string {
    const principal = principalIdOf(claims);
    if (!principal) {
      throw new UnauthorizedError(ErrorMessage.UNAUTHORIZED);
    }
    return principal;
  }

  private assertConversationAccess(claims: AuthClaims, conversationKey: string): void {
    if (!canAccessConversation(claims, conversationKey)) {
      throw new ForbiddenError(ErrorMessage.FORBIDDEN);
    }
  }

  private collectFiles(req: Request): UploadFileInput[] {
    const fields = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const all = [...(fields.file ?? []), ...(fields.files ?? [])];
    return all.map((file) => ({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    }));
  }
}
