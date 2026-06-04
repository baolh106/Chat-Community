import type { IUnitOfWork } from "../../../infrastructure/IUnitOfWork";
import { BadRequestError } from "../../../shared/utils/error";
import type { IMessageRepository } from "../domain/mesage.repository";
import type { IMessageOutboxRepository } from "../domain/message-outbox.repository";
import type { IMessageSessionCache } from "../infrastructure/cache/message-session.cache";
import type { MessageCreate } from "./dtos/param";
import type { IMessageApplication } from "./message.application.interface";
import type {
  IFileStorage,
  StoredFile,
  UploadFileInput,
} from "./ports/file-storage.port";

export class MessageApplication implements IMessageApplication {
  constructor(
    private readonly _messageRepo: IMessageRepository,
    private readonly _uow: IUnitOfWork,
    private readonly _outboxRepo: IMessageOutboxRepository,
    private readonly _sessionCache?: IMessageSessionCache,
    private readonly _fileStorage?: IFileStorage,
  ) {}

  public async create(message: MessageCreate) {
    this.validateMessage(message);

    await this._uow.runInTransaction(async () => {
      await this._messageRepo.create(message);
      await this._outboxRepo.createMessageCreated(message);
    });
  }

  public async createWithFile(
    message: MessageCreate,
    file: UploadFileInput,
  ): Promise<void> {
    if (!this._fileStorage) {
      throw new BadRequestError("File storage is not configured");
    }

    const storedFile = await this._fileStorage.upload(file);
    await this.create(this.attachStoredFile(message, storedFile));
  }

  public async insertList(arrMessage: MessageCreate[]) {
    arrMessage.forEach((message) => this.validateMessage(message));

    await this._uow.runInTransaction(async () => {
      await this._messageRepo.insertList(arrMessage);
      await Promise.all(
        arrMessage.map((message) =>
          this._outboxRepo.createMessageCreated(message),
        ),
      );
    });
  }

  public async getMessagesByUserId(userId: string): Promise<MessageCreate[]> {
    if (this._sessionCache) {
      return await this._sessionCache.getMessages(userId);
    }
    return [];
  }

  public async markMessagesAsRead(
    userId: string,
    readerId: string,
  ): Promise<number> {
    if (!this._sessionCache) {
      return 0;
    }
    return await this._sessionCache.markMessagesAsRead(userId, readerId);
  }

  public async getUnreadCount(
    userId: string,
    readerId: string,
  ): Promise<number> {
    if (!this._sessionCache) {
      return 0;
    }
    return await this._sessionCache.getUnreadCount(userId, readerId);
  }

  private attachStoredFile(
    message: MessageCreate,
    storedFile: StoredFile,
  ): MessageCreate {
    return {
      ...message,
      fileURL: storedFile.url,
      fileDownloadURL: storedFile.downloadUrl,
      fileName: storedFile.name,
      fileMimeType: storedFile.mimeType,
      fileSize: storedFile.size,
      fileDriveId: storedFile.driveId,
      attachmentType: storedFile.type,
      ...(storedFile.type === "image" ? { imageURL: storedFile.url } : {}),
    };
  }

  private validateMessage(message: MessageCreate): void {
    if (!message.sender || !message.receiver) {
      throw new BadRequestError("sender and receiver are required");
    }

    const hasContent =
      typeof message.content === "string" && message.content.trim().length > 0;
    const hasAttachment = Boolean(message.imageURL || message.fileURL);

    if (!hasContent && !hasAttachment) {
      throw new BadRequestError("message content or file is required");
    }
  }
}
