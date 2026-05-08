import type { SurrealDbContext } from "../../../config/database/surrealDBContext";
import type { IUnitOfWork } from "../../../infrastructure/IUnitOfWork";
import type { IEventBus } from "../../event-bus/application/event-bus.interface";
import { MessageAPI } from "../api/message";
import { MessageApplication } from "../application/message.application";
import { MessageRepo } from "../infrastructure/surreal/message.repo";
import { MessageSessionCache } from "../infrastructure/cache/message-session.cache";
import { SessionManager } from "../application/session-manager";

export const messageModule = (
  pool: SurrealDbContext,
  uow: IUnitOfWork,
  eventBus: IEventBus,
) => {
  const repo = new MessageRepo(pool);
  const sessionCache = new MessageSessionCache();
  const sessionManager = new SessionManager(sessionCache, repo);
  const messageApp = new MessageApplication(
    repo,
    uow,
    eventBus,
    sessionCache,
  );
  const messageApi = new MessageAPI(messageApp);
  return {
    messageApi,
    messageApp,
    repo,
    sessionManager,
  };
};
