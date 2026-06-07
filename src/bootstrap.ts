import { mongoConfig, surrealConfig } from "./config/database/database";
import { SurrealDbContext } from "./config/database/surrealDBContext";
import type { IDbExecutor } from "./shared/database/db-executor.interface";
import type { IEventBus } from "./infrastructure/event-bus/application/event-bus.interface";
import { eventBusModule } from "./infrastructure/event-bus/presentation/event-bus.module";
import type { ISocketApplication } from "./infrastructure/socket/application/socket.application.interface";
import {
  setupSocketServer,
  type AttachSocketServerOptions,
} from "./infrastructure/socket/presentation/socket.module";
import type { ITelegramNotifier } from "./infrastructure/telegram/application/telegram.notifier.interface";
import { UnitOfWorkSurreal } from "./infrastructure/UnitOfWork-SurrealDB";
import { UserJoinedToolHandler } from "./modules/auth/application/handlers/user-joined-tool.handler";
import { UserJoinedTelegramNotifier } from "./modules/auth/infrastructure/telegram/user-joined-telegram.notifier";
import { authModule } from "./modules/auth/presentation/auth.module";
import { SendMessageSocketHandler } from "./modules/message/application/handlers/send-message-socket.handler";
import { SendMessageToolHandler } from "./modules/message/application/handlers/send-message-tool.handler";
import type { IMessageApplication } from "./modules/message/application/message.application.interface";
import type { ISessionManager } from "./modules/message/application/session-manager.interface";
import { MessageAdminSocketNotifier } from "./modules/message/infrastructure/realtime/message-admin-socket.notifier";
import { MessageUserSocketNotifier } from "./modules/message/infrastructure/realtime/message-user-socket.notifier";
import { MessageAdminTelegramNotifier } from "./modules/message/infrastructure/telegram/message-admin-telegram.notifier";
import { messageModule } from "./modules/message/presentation/message.module";
import { connectDB } from "./shared/database/surrealDB.connect";
import { connectMongoClient } from "./shared/database/mongoDB.connect";
import { MongoDbContext } from "./config/database/mongoDBContext";
import { UnitOfWorkMongo } from "./infrastructure/UnitOfWork-Mongo";
import type { IUnitOfWork } from "./infrastructure/IUnitOfWork";
import { VideoCallTelegramHandler } from "./infrastructure/telegram/handlers/video-call-telegram.handler";
import { GramJsCallService } from "./infrastructure/telegram/infrastructure/gramjs-call.service";

async function setupSurrealDB() {
  const db = await connectDB(surrealConfig);
  const dbContext = new SurrealDbContext(db, surrealConfig);
  const uow = new UnitOfWorkSurreal(dbContext);
  return { dbContext, uow };
}

async function setupMongoDB() {
  const client = await connectMongoClient(mongoConfig);
  const dbContext = new MongoDbContext(client, mongoConfig);
  const uow = new UnitOfWorkMongo(dbContext.getConnection());
  return { dbContext, uow };
}

export async function setupDatabase() {
  return await setupMongoDB();
}

export async function setupModules(
  dbContext: IDbExecutor,
  uow: IUnitOfWork,
) {
  const { eventBus } = eventBusModule();
  const {
    messageApi,
    messageApp,
    sessionManager,
    messageOutboxWorker,
    outboxRepo,
    messageRepo,
  } = messageModule(dbContext, uow, eventBus);
  const authApi = authModule(dbContext, eventBus).authApi;

  // Ensure table ready before starting the application
  await ensureDatabaseReady([
    messageRepo, outboxRepo
  ]);

  const routes = [
    { path: "/auth", router: authApi.api() },
    { path: "/message", router: messageApi.api() },
  ];

  return { eventBus, routes, sessionManager, messageApp, messageOutboxWorker };
}

async function ensureDatabaseReady(schemas: any[]) {
  try {
    await Promise.all(schemas.map((repo) => repo.ensureReady()));
  } catch (error) {
    console.error("[Bootstrap] Error ensuring database readiness:", error);
    throw error;
  }
}

export async function setupSocket(
  httpServer: any,
  opts: AttachSocketServerOptions,
  deps: {
    sessionManager: ISessionManager;
    messageApplication: IMessageApplication;
    eventBus: IEventBus;
  },
) {
  const { disposeRedis, socketService } = await setupSocketServer(
    httpServer,
    opts,
    deps,
  );
  return { disposeRedis, socketService };
}

export function setupEventHandlers(
  eventBus: IEventBus,
  socketService: ISocketApplication,
  telegramNotifier?: ITelegramNotifier,
) {
  // Register event handlers
  // const adminNotifier = new MessageAdminSocketNotifier(socketService);
  // const userNotifier = new MessageUserSocketNotifier(socketService);
  const messageToolNotifier = new MessageAdminTelegramNotifier(socketService, telegramNotifier);
  const userJoinedToolNotifier = new UserJoinedTelegramNotifier(telegramNotifier);
  // eventBus.register(new SendMessageSocketHandler(adminNotifier));
  // eventBus.register(new SendMessageSocketHandler(userNotifier));
  eventBus.register(new SendMessageToolHandler(messageToolNotifier));
  eventBus.register(new UserJoinedToolHandler(userJoinedToolNotifier));
  
  // Register Video Call Handler
  const telegramCallService = new GramJsCallService();
  eventBus.register(new VideoCallTelegramHandler(telegramNotifier, telegramCallService));
}
  
