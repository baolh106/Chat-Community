import type { RequestHandler } from "express";
import {
  uploadMaxFileSizeMb,
  uploadMaxFilesPerMessage,
} from "../../../config/env";
import { NudeNetDetectorService } from "../../../infrastructure/client/nudenet-detector.service";
import type { IEventBus } from "../../../infrastructure/event-bus/application/event-bus.interface";
import { GoogleDriveFileStorage } from "../../../infrastructure/google-drive/google-drive-file-storage";
import type { IUnitOfWork } from "../../../infrastructure/IUnitOfWork";
import type { RedisClient } from "../../../infrastructure/redis";
import type { IDbExecutor } from "../../../shared/database/db-executor.interface";
import { MessageAPI } from "../api/message";
import { MessageOutboxWorker } from "../application/message-outbox.worker";
import { MessageApplication } from "../application/message.application";
import type { ISessionRevoker } from "../application/ports/session-revoker.port";
import { SessionManager } from "../application/session-manager";
import { MessageSessionCache } from "../infrastructure/cache/message-session.cache";
import { MessageOutboxRepo } from "../infrastructure/mongo/message-outbox.repo";
import { MessageRepo } from "../infrastructure/mongo/message.repo";

export type MessageModuleDeps = {
  dbExecutor: IDbExecutor;
  uow: IUnitOfWork;
  eventBus: IEventBus;
  redis: RedisClient;
  requireAuth: RequestHandler;
  sessionRevoker?: ISessionRevoker;
};

export const messageModule = (deps: MessageModuleDeps) => {
  const limits = {
    maxFileSizeBytes: uploadMaxFileSizeMb * 1024 * 1024,
    maxFilesPerMessage: uploadMaxFilesPerMessage,
  };

  const messageRepo = new MessageRepo(deps.dbExecutor);
  const outboxRepo = new MessageOutboxRepo(deps.dbExecutor);
  const sessionCache = new MessageSessionCache(deps.redis);
  const sessionManager = new SessionManager(sessionCache, deps.sessionRevoker);
  const messageOutboxWorker = new MessageOutboxWorker(
    outboxRepo,
    deps.eventBus,
    sessionCache,
  );
  const messageApp = new MessageApplication(
    {
      messageRepo,
      uow: deps.uow,
      outboxRepo,
      sessionCache,
      fileStorage: new GoogleDriveFileStorage(),
      imageDetector: new NudeNetDetectorService(),
    },
    limits,
  );
  const messageApi = new MessageAPI(messageApp, deps.requireAuth, limits);

  return {
    messageApi,
    messageApp,
    messageRepo,
    sessionManager,
    messageOutboxWorker,
    outboxRepo,
  };
};
