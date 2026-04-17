import type { IBusEventHandler } from "../../../event-bus/domain/bus-event-handler.interface";
import {
  MESSAGE_CREATED_TOPIC,
  type MessageCreatedEvent,
} from "../../domain/events/message-created.event";
import type { IAdminRealtimeNotifier } from "../ports/admin-realtime.port";

export class MessageCreatedAdminSocketHandler implements IBusEventHandler<MessageCreatedEvent> {
  readonly handles = MESSAGE_CREATED_TOPIC;

  constructor(private readonly _admin: IAdminRealtimeNotifier) {}

  async handle(event: MessageCreatedEvent): Promise<void> {
    this._admin.notifyNewMessage(event.payload);
  }
}
