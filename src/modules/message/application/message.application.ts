import type { IUnitOfWork } from "../../../infrastructure/IUnitOfWork";
import type { IEventBusPublisher } from "../../../infrastructure/event-bus/application/event-bus-publisher.interface";
import { MessageCreatedEvent } from "../domain/events/message-created.event";
import type { IMessageRepository } from "../domain/mesage.repository";
import type { MessageCreate } from "./dtos/param";
import type { IMessageApplication } from "./message.application.interface";
import type { IMessageSessionCache } from "../infrastructure/cache/message-session.cache";

export class MessageApplication implements IMessageApplication {
  constructor(
    private readonly _messageRepo: IMessageRepository,
    private readonly _uow: IUnitOfWork,
    private readonly _eventBus: IEventBusPublisher,
    private readonly _sessionCache?: IMessageSessionCache,
  ) {}

  public async create(message: MessageCreate) {
    if (this._sessionCache) {
      await this._sessionCache.appendMessage(message.sender, message);
      await this._eventBus.publish(new MessageCreatedEvent(message));
      return;
    }

    await this._uow.runInTransaction(async () => {
      await this._messageRepo.create(message);
      await this._eventBus.publish(new MessageCreatedEvent(message));
    });
  }

  public async insertList(arrMessage: MessageCreate[]) {
    if (this._sessionCache) {
      const groupedBySender = new Map<string, MessageCreate[]>();
      for (const message of arrMessage) {
        const group = groupedBySender.get(message.sender) ?? [];
        group.push(message);
        groupedBySender.set(message.sender, group);
      }

      for (const [sender, messages] of groupedBySender.entries()) {
        await this._sessionCache.appendMessages(sender, messages);
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
}
