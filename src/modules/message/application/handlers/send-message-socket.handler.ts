import type { IBusEventHandler } from "../../../../infrastructure/event-bus/domain/bus-event-handler.interface";
import {
  MESSAGE_CREATED_TOPIC,
  type MessageCreatedEvent,
} from "../../domain/events/message-created.event";
import type { IRealtimeNotifier } from "../ports/realtime.port";
import { createLogger } from "../../../../shared/logging/logger";

const logger = createLogger("event-handler");

export class SendMessageSocketHandler implements IBusEventHandler<MessageCreatedEvent> {
  readonly handles = MESSAGE_CREATED_TOPIC;

  constructor(private readonly _realtime: IRealtimeNotifier) {}

  async handle(event: MessageCreatedEvent): Promise<void> {
    const { sender, receiver } = event.payload;
    logger.debug("dispatching realtime message", { topic: this.handles, sender, receiver });
    await this._realtime.notifyNewMessage(event.payload);
  }
}
