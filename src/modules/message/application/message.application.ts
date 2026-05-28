import type { IUnitOfWork } from "../../../infrastructure/IUnitOfWork";
import type { IEventBusPublisher } from "../../../infrastructure/event-bus/application/event-bus-publisher.interface";
import { BadRequestError } from "../../../shared/utils/error";
import { MessageCreatedEvent } from "../domain/events/message-created.event";
import type { IMessageRepository } from "../domain/mesage.repository";
import type { MessageCreate } from "./dtos/param";
import type { IMessageApplication } from "./message.application.interface";
import type { IMessageSessionCache } from "../infrastructure/cache/message-session.cache";
import type {
  IFileStorage,
  StoredFile,
  UploadFileInput,
} from "./ports/file-storage.port";

export class MessageApplication implements IMessageApplication {
  constructor(
    private readonly _messageRepo: IMessageRepository,
    private readonly _uow: IUnitOfWork,
    private readonly _eventBus: IEventBusPublisher,
    private readonly _sessionCache?: IMessageSessionCache,
    private readonly _fileStorage?: IFileStorage,
  ) {}

  public async create(message: MessageCreate) {
    this.validateMessage(message);
    if (this._sessionCache) {
      const conversationKey =
        message.sender === "admin" ? message.receiver : message.sender;
      await this._sessionCache.appendMessage(conversationKey, message);
      await this._eventBus.publish(new MessageCreatedEvent(message));
      return;
    }

    await this._uow.runInTransaction(async () => {
      await this._messageRepo.create(message);
      await this._eventBus.publish(new MessageCreatedEvent(message));
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
    if (this._sessionCache) {
      const groupedByConversation = new Map<string, MessageCreate[]>();
      for (const message of arrMessage) {
        const key =
          message.sender === "admin" ? message.receiver : message.sender;
        const group = groupedByConversation.get(key) ?? [];
        group.push(message);
        groupedByConversation.set(key, group);
      }

      for (const [
        conversationKey,
        messages,
      ] of groupedByConversation.entries()) {
        await this._sessionCache.appendMessages(conversationKey, messages);
      }

      await Promise.all(
        arrMessage.map((m) =>
          this._eventBus.publish(new MessageCreatedEvent(m)),
        ),
      );
      return;
    }

    await this._uow.runInTransaction(async () => {
      await this._messageRepo.insertList(arrMessage);
      await Promise.all(
        arrMessage.map((m) =>
          this._eventBus.publish(new MessageCreatedEvent(m)),
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
