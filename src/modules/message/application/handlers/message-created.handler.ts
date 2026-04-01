import type { IBusEventHandler } from "../../../event-bus/domain/bus-event-handler.interface";
import {
  MESSAGE_CREATED_TOPIC,
  type MessageCreatedEvent,
} from "../../domain/events/message-created.event";

/**
 * Example subscriber: replace with push/email/socket adapters in infrastructure.
 */
export class MessageCreatedLogHandler
  implements IBusEventHandler<MessageCreatedEvent>
{
  readonly handles = MESSAGE_CREATED_TOPIC;

  async handle(event: MessageCreatedEvent): Promise<void> {
    const { sender, receiver, content } = event.payload;
    console.log(
      `[event-bus] message.created ${sender} -> ${receiver}: ${content.slice(0, 80)}${content.length > 80 ? "…" : ""}`,
    );
  }
}
