import type { IBusEvent } from "../../../event-bus/domain/bus-event.interface";

export const MESSAGE_CREATED_TOPIC = "message.created" as const;

export type MessageCreatedPayload = {
  content: string;
  imageURL?: string;
  createdAt: Date;
  sender: string;
  receiver: string;
};

export class MessageCreatedEvent implements IBusEvent {
  readonly topic = MESSAGE_CREATED_TOPIC;

  constructor(public readonly payload: MessageCreatedPayload) {}
}
