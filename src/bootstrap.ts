import type { Server as HttpServer } from "node:http";
import { mongoConfig, surrealConfig } from "./config/database/database";
import { MongoDbContext } from "./config/database/mongoDBContext";
import { SurrealDbContext } from "./config/database/surrealDBContext";
import type { IEventBus } from "./infrastructure/event-bus/application/event-bus.interface";
import { eventBusModule } from "./infrastructure/event-bus/presentation/event-bus.module";
import type { IUnitOfWork } from "./infrastructure/IUnitOfWork";
import type { RedisClient } from "./infrastructure/redis";
import type { ISocketApplication } from "./infrastructure/socket/application/socket.application.interface";
import {
  setupSocketServer,
  type AttachSocketServerOptions,
  type SocketServerDependencies,
} from "./infrastructure/socket/presentation/socket.module";
import type { ITelegramCallService } from "./infrastructure/telegram/application/telegram-call.service.interface";
import type { ITelegramNotifier } from "./infrastructure/telegram/application/telegram.notifier.interface";
import { VideoCallTelegramHandler } from "./infrastructure/telegram/handlers/video-call-telegram.handler";
import { UnitOfWorkMongo } from "./infrastructure/UnitOfWork-Mongo";
import { UnitOfWorkSurreal } from "./infrastructure/UnitOfWork-SurrealDB";
import { UserJoinedToolHandler } from "./modules/auth/application/handlers/user-joined-tool.handler";
import { UserJoinedTelegramNotifier } from "./modules/auth/infrastructure/telegram/user-joined-telegram.notifier";
import { authModule } from "./modules/auth/presentation/auth.module";
import { SendMessageToolHandler } from "./modules/message/application/handlers/send-message-tool.handler";
import { MessageAdminTelegramNotifier } from "./modules/message/infrastructure/telegram/message-admin-telegram.notifier";
import { messageModule } from "./modules/message/presentation/message.module";
import type { IDbExecutor } from "./shared/database/db-executor.interface";
import { connectMongoClient } from "./shared/database/mongoDB.connect";
import { connectDB } from "./shared/database/surrealDB.connect";

export async function setupSurrealDB() {
  const db = await connectDB(surrealConfig);
  const dbContext = new SurrealDbContext(db, surrealConfig);
  const uow = new UnitOfWorkSurreal(dbContext);
  return { dbContext, uow, close: async () => { await db.close(); } };
}

async function setupMongoDB() {
  const client = await connectMongoClient(mongoConfig);
  const dbContext = new MongoDbContext(client, mongoConfig);
  const uow = new UnitOfWorkMongo(dbContext.getConnection());
  return { dbContext, uow, close: () => client.close() };
}

export async function setupDatabase(): Promise<{
  dbContext: IDbExecutor;
  uow: IUnitOfWork;
  close: () => Promise<void>;
}> {
  return await setupMongoDB();
}

export async function setupModules(
  dbContext: IDbExecutor,
  uow: IUnitOfWork,
  redis: RedisClient,
) {
  const { eventBus } = eventBusModule();
  const auth = authModule(dbContext, redis);
  const message = messageModule({
    dbExecutor: dbContext,
    uow,
    eventBus,
    redis,
    requireAuth: auth.requireAuth,
    sessionRevoker: { revoke: (userId) => auth.refreshTokenStore.revoke(userId) },
  });

  await ensureDatabaseReady([message.messageRepo, message.outboxRepo]);

  const routes = [
    { path: "/auth", router: auth.authApi.api() },
    { path: "/message", router: message.messageApi.api() },
  ];

  return {
    eventBus,
    routes,
    tokenVerifier: auth.tokenVerifier,
    sessionManager: message.sessionManager,
    messageApp: message.messageApp,
    messageOutboxWorker: message.messageOutboxWorker,
  };
}

async function ensureDatabaseReady(repos: Array<{ ensureReady(): Promise<void> }>) {
  try {
    await Promise.all(repos.map((repo) => repo.ensureReady()));
  } catch (error) {
    console.error("[Bootstrap] Error ensuring database readiness:", error);
    throw error;
  }
}

export async function setupSocket(
  httpServer: HttpServer,
  opts: AttachSocketServerOptions,
  deps: SocketServerDependencies,
) {
  return await setupSocketServer(httpServer, opts, deps);
}

export function setupEventHandlers(
  eventBus: IEventBus,
  socketService: ISocketApplication,
  telegramNotifier: ITelegramNotifier,
  telegramCallService?: ITelegramCallService,
) {
  const messageToolNotifier = new MessageAdminTelegramNotifier(socketService, telegramNotifier);
  const userJoinedToolNotifier = new UserJoinedTelegramNotifier(telegramNotifier);
  eventBus.register(new SendMessageToolHandler(messageToolNotifier));
  eventBus.register(new UserJoinedToolHandler(userJoinedToolNotifier));
  eventBus.register(new VideoCallTelegramHandler(telegramNotifier, telegramCallService));
}
