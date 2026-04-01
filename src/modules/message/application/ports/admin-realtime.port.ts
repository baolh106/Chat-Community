import type { MessageCreatedPayload } from "../../domain/events/message-created.event";

export interface IAdminRealtimeNotifier {
  notifyNewMessage(payload: MessageCreatedPayload): void;
}
