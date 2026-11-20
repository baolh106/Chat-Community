import type { IBusEventHandler } from "../../../../infrastructure/event-bus/domain/bus-event-handler.interface";
import { USER_JOINED_TOPIC, type UserJoinedEvent } from "../../domain/events/user-joined.event";
import type { IToolNotifier } from "../ports/tool.port";
import { createLogger } from "../../../../shared/logging/logger";

const logger = createLogger("event-handler");

export class UserJoinedToolHandler implements IBusEventHandler<UserJoinedEvent> {
  readonly handles = USER_JOINED_TOPIC;

  constructor(private readonly _tool: IToolNotifier) {}

  async handle(event: UserJoinedEvent): Promise<void> {
    const { userId } = event.payload;
    logger.info("user joined", { tool: this._tool.getNameTool(), topic: this.handles, joinedUserId: userId });
    await this._tool.notifyUserJoined(event.payload);
  }
}
