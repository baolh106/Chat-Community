import type { MessageCreatedPayload } from "../../domain/events/message-created.event";

export interface IToolNotifier {
  getNameTool(): string;
  notifyNewMessage(payload: MessageCreatedPayload): Promise<void>;
}
