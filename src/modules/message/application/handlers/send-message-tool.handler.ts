import type { IBusEventHandler } from "../../../../infrastructure/event-bus/domain/bus-event-handler.interface";
import {
  MESSAGE_CREATED_TOPIC,
  type MessageCreatedEvent,
} from "../../domain/events/message-created.event";
import type { IToolNotifier } from "../ports/tool.port";

export class SendMessageToolHandler implements IBusEventHandler<MessageCreatedEvent> {
  readonly handles = MESSAGE_CREATED_TOPIC;

  constructor(private readonly _tool: IToolNotifier) {}

  async handle(event: MessageCreatedEvent): Promise<void> {
    const { sender } = event.payload;
    console.log(
      `[event-bus] : ${this._tool.getNameTool()} ${this.handles} ${sender} sent a message`,
    );
    await this._tool.notifyNewMessage(event.payload);
  }
}
