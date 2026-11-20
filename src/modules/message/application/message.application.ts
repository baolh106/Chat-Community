import { randomUUID } from "node:crypto";
import type { IUnitOfWork } from "../../../infrastructure/IUnitOfWork";
import { BadRequestError } from "../../../shared/utils/error";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MessageLimits,
} from "../constant/constant";
import type { MessageAttachment } from "../domain/entities/message-attachment";
import type { IMessageRepository } from "../domain/mesage.repository";
import type { IMessageOutboxRepository } from "../domain/message-outbox.repository";
import type { MessageCreate } from "./dtos/param";
import type { IMessageApplication } from "./message.application.interface";
import type {
  IFileStorage,
  StoredFile,
  UploadFileInput,
} from "./ports/file-storage.port";
import type { IImageDetectorService } from "./ports/image-detector.port";
import type { IMessageSessionCache } from "./ports/message-session-cache.port";
import { createLogger } from "../../../shared/logging/logger";

const logger = createLogger("message");

export type MessageApplicationOptions = {
  maxFileSizeBytes: number;
  maxFilesPerMessage: number;
};

export type MessageApplicationDeps = {
  messageRepo: IMessageRepository;
  uow: IUnitOfWork;
  outboxRepo: IMessageOutboxRepository;
  sessionCache?: IMessageSessionCache | undefined;
  fileStorage?: IFileStorage | undefined;
  imageDetector?: IImageDetectorService | undefined;
};

export class MessageApplication implements IMessageApplication {
  private readonly _messageRepo: IMessageRepository;
  private readonly _uow: IUnitOfWork;
  private readonly _outboxRepo: IMessageOutboxRepository;
  private readonly _sessionCache: IMessageSessionCache | undefined;
  private readonly _fileStorage: IFileStorage | undefined;
  private readonly _imageDetector: IImageDetectorService | undefined;

  constructor(
    deps: MessageApplicationDeps,
    private readonly _options: MessageApplicationOptions,
  ) {
    this._messageRepo = deps.messageRepo;
    this._uow = deps.uow;
    this._outboxRepo = deps.outboxRepo;
    this._sessionCache = deps.sessionCache;
    this._fileStorage = deps.fileStorage;
    this._imageDetector = deps.imageDetector;
  }

  public async create(input: MessageCreate): Promise<MessageCreate> {
    const message = this.normalize(input);
    this.validateMessage(message);

    await this._uow.runInTransaction(async () => {
      await this._messageRepo.create(message);
      await this._outboxRepo.createMessageCreated(message);
    });
    return message;
  }

  public async createWithFiles(
    input: MessageCreate,
    files: UploadFileInput[],
  ): Promise<MessageCreate> {
    if (!this._fileStorage) {
      throw new BadRequestError("File storage is not configured");
    }
    this.validateFiles(files);

    const message = this.normalize(input);
    this.validateMessage(message, { attachmentsPending: true });

    const storage = this._fileStorage;
    const storedFiles = await Promise.all(files.map((file) => storage.upload(file)));
    const attachments = await Promise.all(
      storedFiles.map((stored) => this.toAttachment(stored)),
    );

    return await this.create(this.withAttachments(message, attachments));
  }

  public async insertList(arrMessage: MessageCreate[]): Promise<void> {
    if (arrMessage.length > MessageLimits.INSERT_LIST_MAX_ITEMS) {
      throw new BadRequestError(
        `At most ${MessageLimits.INSERT_LIST_MAX_ITEMS} messages per request`,
      );
    }
    const messages = arrMessage.map((message) => this.normalize(message));
    messages.forEach((message) => this.validateMessage(message));

    await this._uow.runInTransaction(async () => {
      await this._messageRepo.insertList(messages);
      for (const message of messages) {
        await this._outboxRepo.createMessageCreated(message);
      }
    });
  }

  public async getMessages(conversationKey: string): Promise<MessageCreate[]> {
    if (!this._sessionCache) {
      return [];
    }
    return await this._sessionCache.getMessages(conversationKey);
  }

  public async markMessagesAsRead(
    conversationKey: string,
    readerId: string,
  ): Promise<number> {
    if (!this._sessionCache) {
      return 0;
    }
    return await this._sessionCache.markMessagesAsRead(conversationKey, readerId);
  }

  public async getUnreadCount(
    conversationKey: string,
    readerId: string,
  ): Promise<number> {
    if (!this._sessionCache) {
      return 0;
    }
    return await this._sessionCache.getUnreadCount(conversationKey, readerId);
  }

  private normalize(message: MessageCreate): MessageCreate {
    const content =
      typeof message.content === "string" && message.content.trim().length > 0
        ? message.content
        : null;
    return {
      ...message,
      id: message.id ?? randomUUID(),
      content,
      createdAt: message.createdAt ?? new Date(),
    };
  }

  private async toAttachment(stored: StoredFile): Promise<MessageAttachment> {
    const attachment: MessageAttachment = {
      fileURL: stored.url,
      fileDownloadURL: stored.downloadUrl,
      fileName: stored.name,
      fileMimeType: stored.mimeType,
      fileSize: stored.size,
      fileDriveId: stored.driveId,
      attachmentType: stored.type,
    };

    if (stored.type === "image" && this._imageDetector) {
      try {
        const result = await this._imageDetector.scanImage(stored.url);
        attachment.isUnsafe = Boolean(result.data?.is_toxic);
      } catch (error) {
        logger.error("image detection failed", { err: error });
      }
    }
    return attachment;
  }

  private withAttachments(
    message: MessageCreate,
    attachments: MessageAttachment[],
  ): MessageCreate {
    const first = attachments[0];
    return {
      ...message,
      attachments,
      isUnsafe: attachments.some((a) => a.isUnsafe === true),
      ...(first
        ? {
            fileURL: first.fileURL,
            fileDownloadURL: first.fileDownloadURL,
            fileName: first.fileName,
            fileMimeType: first.fileMimeType,
            fileSize: first.fileSize,
            fileDriveId: first.fileDriveId,
            attachmentType: first.attachmentType,
            ...(first.attachmentType === "image" ? { imageURL: first.fileURL } : {}),
          }
        : {}),
    };
  }

  private validateFiles(files: UploadFileInput[]): void {
    if (files.length === 0) {
      throw new BadRequestError("At least one file is required");
    }
    if (files.length > this._options.maxFilesPerMessage) {
      throw new BadRequestError(
        `At most ${this._options.maxFilesPerMessage} files per message`,
      );
    }
    for (const file of files) {
      if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimeType)) {
        throw new BadRequestError(`File type not allowed: ${file.mimeType}`);
      }
      if (file.size <= 0 || file.buffer.length === 0) {
        throw new BadRequestError(`File is empty: ${file.originalName}`);
      }
      if (file.size > this._options.maxFileSizeBytes) {
        throw new BadRequestError(`File too large: ${file.originalName}`);
      }
      if (
        file.originalName.length === 0 ||
        file.originalName.length > MessageLimits.FILE_NAME_MAX_LENGTH
      ) {
        throw new BadRequestError("Invalid file name");
      }
    }
  }

  private validateMessage(
    message: MessageCreate,
    opts: { attachmentsPending?: boolean } = {},
  ): void {
    if (!message.sender || !message.receiver) {
      throw new BadRequestError("sender and receiver are required");
    }

    if (
      typeof message.content === "string" &&
      message.content.length > MessageLimits.CONTENT_MAX_LENGTH
    ) {
      throw new BadRequestError(
        `Message content must be at most ${MessageLimits.CONTENT_MAX_LENGTH} characters`,
      );
    }

    const hasContent = typeof message.content === "string" && message.content.length > 0;
    const hasAttachment = Boolean(
      opts.attachmentsPending ||
        (message.attachments && message.attachments.length > 0) ||
        message.imageURL ||
        message.fileURL,
    );

    if (!hasContent && !hasAttachment) {
      throw new BadRequestError("message content or file is required");
    }
  }
}
