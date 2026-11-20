import type { IBusEventHandler } from "../../../../infrastructure/event-bus/domain/bus-event-handler.interface";
import {
  MESSAGE_CREATED_TOPIC,
  type MessageCreatedEvent,
} from "../../domain/events/message-created.event";
import type { IToolNotifier } from "../ports/tool.port";
import { createLogger } from "../../../../shared/logging/logger";

const logger = createLogger("event-handler");

export class SendMessageToolHandler implements IBusEventHandler<MessageCreatedEvent> {
  readonly handles = MESSAGE_CREATED_TOPIC;

  constructor(private readonly _tool: IToolNotifier) {}

  async handle(event: MessageCreatedEvent): Promise<void> {
    const { sender } = event.payload;
    logger.debug("notifying tool of new message", { tool: this._tool.getNameTool(), topic: this.handles, sender });
    await this._tool.notifyNewMessage(event.payload);
  }
}
