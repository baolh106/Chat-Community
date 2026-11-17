import type { IBusEvent } from "../../../../infrastructure/event-bus/domain/bus-event.interface";
import type { PayloadMessage } from "../dtos/payloadMessage.dto";

export const MESSAGE_CREATED_TOPIC = "message.created" as const;

export type MessageCreatedPayload = PayloadMessage;

export class MessageCreatedEvent implements IBusEvent {
  readonly topic = MESSAGE_CREATED_TOPIC;

  constructor(
    public readonly payload: MessageCreatedPayload,
    public readonly eventId?: string,
  ) {}
}
