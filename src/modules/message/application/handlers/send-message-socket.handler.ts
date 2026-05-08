import type { IBusEventHandler } from "../../../event-bus/domain/bus-event-handler.interface";
import {
  MESSAGE_CREATED_TOPIC,
  type MessageCreatedEvent,
} from "../../domain/events/message-created.event";
import type { IRealtimeNotifier } from "../ports/realtime.port";

export class SendMessageSocketHandler implements IBusEventHandler<MessageCreatedEvent> {
  readonly handles = MESSAGE_CREATED_TOPIC;

  constructor(private readonly _realtime: IRealtimeNotifier) {}

  async handle(event: MessageCreatedEvent): Promise<void> {
    const { sender, receiver, content } = event.payload;
    console.log(
      `[event-bus] ${this.handles} ${sender} -> ${receiver}: ${content ? content.slice(0, 80) + (content.length > 80 ? "…" : "") : "<no content>"}`,
    );
    // Real-time
    this._realtime.notifyNewMessage(event.payload);
  }
}
