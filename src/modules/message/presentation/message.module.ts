import type { SurrealDbContext } from "../../../config/database/surrealDBContext";
import type { IUnitOfWork } from "../../../infrastructure/IUnitOfWork";
import type { IEventBus } from "../../event-bus/application/event-bus.interface";
import { MessageAPI } from "../api/message";
import { MessageApplication } from "../application/message.application";
import { MessageCreatedLogHandler } from "../application/handlers/message-created.handler";
import { MessageRepo } from "../infrastructure/surreal/message.repo";

export const messageModule = (
  pool: SurrealDbContext,
  uow: IUnitOfWork,
  eventBus: IEventBus,
) => {
  eventBus.register(new MessageCreatedLogHandler());
  const repo = new MessageRepo(pool);
  const messageApp = new MessageApplication(repo, uow, eventBus);
  const messageApi = new MessageAPI(messageApp);
  return {
    messageApi,
    messageApp,
    repo,
  };
};
