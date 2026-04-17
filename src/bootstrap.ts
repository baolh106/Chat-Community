import { surrealConfig } from "./config/database/database";
import { SurrealDbContext } from "./config/database/surrealDBContext";
import { UnitOfWorkSurreal } from "./infrastructure/UnitOfWork-SurrealDB";
import { authModule } from "./modules/auth/presentation/auth.module";
import type { IEventBus } from "./modules/event-bus/application/event-bus.interface";
import { eventBusModule } from "./modules/event-bus/presentation/event-bus.module";
import { MessageCreatedAdminSocketHandler } from "./modules/message/application/handlers/message-created-admin-socket.handler";
import { MessageAdminSocketNotifier } from "./modules/message/infrastructure/realtime/message-admin-socket.notifier";
import { messageModule } from "./modules/message/presentation/message.module";
import type { ISocketApplication } from "./modules/socket/application/socket.application.interface";
import {
  setupSocketServer,
  type AttachSocketServerOptions,
} from "./modules/socket/presentation/socket.module";
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
  const messageApi = messageModule(dbContext, uow, eventBus).messageApi;
  const authApi = authModule(dbContext).authApi;

  const routes = [
    { path: "/auth", router: authApi.api() },
    { path: "/message", router: messageApi.api() },
  ];

  return { eventBus, routes };
}

export async function setupSocket(
  httpServer: any,
  opts: AttachSocketServerOptions,
) {
  const { disposeRedis, socketService } = await setupSocketServer(
    httpServer,
    opts,
  );
  return { disposeRedis, socketService };
}

export function setupEventHandlers(
  eventBus: IEventBus,
  socketService: ISocketApplication,
) {
  // Register event handlers
  const adminNotifier = new MessageAdminSocketNotifier(socketService);
  eventBus.register(new MessageCreatedAdminSocketHandler(adminNotifier));
}
