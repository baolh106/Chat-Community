import type { IDbExecutor } from "../../../shared/database/db-executor.interface";
import type { IUnitOfWork } from "../../../infrastructure/IUnitOfWork";
import type { IEventBus } from "../../../infrastructure/event-bus/application/event-bus.interface";
import { MessageAPI } from "../api/message";
import { MessageApplication } from "../application/message.application";
import { MessageRepo } from "../infrastructure/surreal/message.repo";
import { MessageSessionCache } from "../infrastructure/cache/message-session.cache";
import { SessionManager } from "../application/session-manager";
import { GoogleDriveFileStorage } from "../../../infrastructure/google-drive/google-drive-file-storage";

export const messageModule = (
  dbExecutor: IDbExecutor,
  uow: IUnitOfWork,
  eventBus: IEventBus,
) => {
  const repo = new MessageRepo(dbExecutor);
  const sessionCache = new MessageSessionCache();
  const fileStorage = new GoogleDriveFileStorage();
  const sessionManager = new SessionManager(sessionCache, repo);
  const messageApp = new MessageApplication(
    repo,
    uow,
    eventBus,
    sessionCache,
    fileStorage,
  );
  const messageApi = new MessageAPI(messageApp);
  return {
    messageApi,
    messageApp,
    repo,
    sessionManager,
  };
};
