import { surrealConfig } from "./config/database/database";
import { SurrealDbContext } from "./config/database/surrealDBContext";
import { UnitOfWorkSurreal } from "./infrastructure/UnitOfWork-SurrealDB";
import { authModule } from "./modules/auth/presentation/auth.module";
import type { IEventBus } from "./infrastructure/event-bus/application/event-bus.interface";
import { eventBusModule } from "./infrastructure/event-bus/presentation/event-bus.module";
import { SendMessageSocketHandler } from "./modules/message/application/handlers/send-message-socket.handler";
import { MessageAdminSocketNotifier } from "./modules/message/infrastructure/realtime/message-admin-socket.notifier";
import { MessageUserSocketNotifier } from "./modules/message/infrastructure/realtime/message-user-socket.notifier";
import { messageModule } from "./modules/message/presentation/message.module";
import type { ISessionManager } from "./modules/message/application/session-manager.interface";
import type { IMessageApplication } from "./modules/message/application/message.application.interface";
import type { ISocketApplication } from "./infrastructure/socket/application/socket.application.interface";
import {
  setupSocketServer,
  type AttachSocketServerOptions,
} from "./infrastructure/socket/presentation/socket.module";
import { connectDB } from "./shared/database/surrealDB.connect";

export async function setupDatabase() {
  const db = await connectDB(surrealConfig);
  const dbContext = new SurrealDbContext(db);
  const uow = new UnitOfWorkSurreal(dbContext);
  return { dbContext, uow };
}

export async function setupModules(
  dbContext: SurrealDbContext,
  uow: UnitOfWorkSurreal,
) {
  const { eventBus } = eventBusModule();
  const {
    messageApi,
    messageApp,
    sessionManager,
  } = messageModule(dbContext, uow, eventBus);
  const authApi = authModule(dbContext).authApi;

  const routes = [
    { path: "/auth", router: authApi.api() },
    { path: "/message", router: messageApi.api() },
  ];

  return { eventBus, routes, sessionManager, messageApp };
}

export async function setupSocket(
  httpServer: any,
  opts: AttachSocketServerOptions,
  sessionManager?: ISessionManager,
  messageApp?: IMessageApplication,
) {
  const { disposeRedis, socketService } = await setupSocketServer(
    httpServer,
    opts,
    sessionManager,
    messageApp,
  );
  return { disposeRedis, socketService };
}

export function setupEventHandlers(
  eventBus: IEventBus,
  socketService: ISocketApplication,
) {
  // Register event handlers
  const adminNotifier = new MessageAdminSocketNotifier(socketService);
  const userNotifier = new MessageUserSocketNotifier(socketService);
  eventBus.register(new SendMessageSocketHandler(adminNotifier));
  eventBus.register(new SendMessageSocketHandler(userNotifier));
}
