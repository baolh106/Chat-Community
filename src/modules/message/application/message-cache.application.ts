import type { IEventBusPublisher } from "../../event-bus/application/event-bus-publisher.interface";
import { MessageCreatedEvent } from "../domain/events/message-created.event";
import type { IMessageSessionCache } from "../infrastructure/cache/message-session.cache";
import type { MessageCreate } from "./dtos/param";
import type { IMessageApplication } from "./message.application.interface";

export class MessageCacheApplication implements IMessageApplication {
  constructor(
    private readonly _eventBus: IEventBusPublisher,
    private readonly _sessionCache: IMessageSessionCache,
  ) {}

  public async create(message: MessageCreate) {
      await this._sessionCache.appendMessage(message.sender, message);
      await this._eventBus.publish(new MessageCreatedEvent(message));
      return;
  }

  public async insertList(arrMessage: MessageCreate[]) {
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
}
