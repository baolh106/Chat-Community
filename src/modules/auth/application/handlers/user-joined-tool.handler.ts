import type { IBusEventHandler } from "../../../../infrastructure/event-bus/domain/bus-event-handler.interface";
import { USER_JOINED_TOPIC, type UserJoinedEvent } from "../../domain/events/user-joined.event";
import type { IToolNotifier } from "../ports/tool.port";

export class UserJoinedToolHandler implements IBusEventHandler<UserJoinedEvent> {
  readonly handles = USER_JOINED_TOPIC;

  constructor(private readonly _tool: IToolNotifier) {}

  async handle(event: UserJoinedEvent): Promise<void> {
    const { userId } = event.payload;
    console.log(
      `[event-bus] : ${this._tool.getNameTool()} ${this.handles} ${userId} joined`,
    );
    await this._tool.notifyUserJoined(event.payload);
  }
}
