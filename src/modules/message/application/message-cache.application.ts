import type { IEventBusPublisher } from "../../../infrastructure/event-bus/application/event-bus-publisher.interface";
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
      const conversationKey = message.sender === "admin" ? message.receiver : message.sender;
      await this._sessionCache.appendMessage(conversationKey, message);
      await this._eventBus.publish(new MessageCreatedEvent(message));
      return;
  }

  public async insertList(arrMessage: MessageCreate[]) {
      const groupedByConversation = new Map<string, MessageCreate[]>();
      for (const message of arrMessage) {
        const key = message.sender === "admin" ? message.receiver : message.sender;
        const group = groupedByConversation.get(key) ?? [];
        group.push(message);
        groupedByConversation.set(key, group);
      }

      for (const [conversationKey, messages] of groupedByConversation.entries()) {
        await this._sessionCache.appendMessages(conversationKey, messages);
      }

      await Promise.all(
        arrMessage.map((m) =>
          this._eventBus.publish(new MessageCreatedEvent(m)),
        ),
      );
      return;
    
  }

  public async getMessagesByUserId(userId: string): Promise<MessageCreate[]> {
    return await this._sessionCache.getMessages(userId);
  }
}
