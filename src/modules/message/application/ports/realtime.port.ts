import type { MessageCreatedPayload } from "../../domain/events/message-created.event";

export interface IRealtimeNotifier {
  notifyNewMessage(payload: MessageCreatedPayload): void;
}
