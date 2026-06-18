import type { IDbExecutor } from "../../../shared/database/db-executor.interface";
import type { IUnitOfWork } from "../../../infrastructure/IUnitOfWork";
import type { IEventBus } from "../../../infrastructure/event-bus/application/event-bus.interface";
import { MessageAPI } from "../api/message";
import { MessageApplication } from "../application/message.application";
import { MessageOutboxWorker } from "../application/message-outbox.worker";
// import { MessageRepo } from "../infrastructure/surreal/message.repo";
// import { MessageOutboxRepo } from "../infrastructure/surreal/message-outbox.repo";
import { MessageSessionCache } from "../infrastructure/cache/message-session.cache";
import { SessionManager } from "../application/session-manager";
import { GoogleDriveFileStorage } from "../../../infrastructure/google-drive/google-drive-file-storage";
import { MessageRepo } from "../infrastructure/mongo/message.repo";
import { MessageOutboxRepo } from "../infrastructure/mongo/message-outbox.repo";
import { NudeNetDetectorService } from "../../../infrastructure/client/nudenet-detector.service";

export const messageModule = (
  dbExecutor: IDbExecutor,
  uow: IUnitOfWork,
  eventBus: IEventBus,
) => {
  const messageRepo = new MessageRepo(dbExecutor);
  const outboxRepo = new MessageOutboxRepo(dbExecutor);
  const sessionCache = new MessageSessionCache();
  const fileStorage = new GoogleDriveFileStorage();
  const sessionManager = new SessionManager(sessionCache);
  const messageOutboxWorker = new MessageOutboxWorker(
    outboxRepo,
    eventBus,
    sessionCache,
  );
  const nudeNetDetectorService = new NudeNetDetectorService();
  const messageApp = new MessageApplication(
    messageRepo,
    uow,
    outboxRepo,
    sessionCache,
    fileStorage,
    nudeNetDetectorService,
  );
  const messageApi = new MessageAPI(messageApp);
  return {
    messageApi,
    messageApp,
    messageRepo,
    sessionManager,
    messageOutboxWorker,
    outboxRepo,
  };
};
