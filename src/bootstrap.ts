import { surrealConfig } from "./config/database/database";
import { SurrealDbContext } from "./config/database/surrealDBContext";
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
  telegramNotifier?: { notifyUserJoined?: (userId: string, room: string, totalUsers: number) => Promise<void> },
) {
  const { disposeRedis, socketService } = await setupSocketServer(
    httpServer,
    opts,
    sessionManager,
    messageApp,
    telegramNotifier,
  );
  return { disposeRedis, socketService };
}

export function setupEventHandlers(
  eventBus: IEventBus,
  socketService: ISocketApplication,
  telegramNotifier?: ITelegramNotifier,
) {
  // Register event handlers
  const adminNotifier = new MessageAdminSocketNotifier(socketService);
  const userNotifier = new MessageUserSocketNotifier(socketService);
  const messageToolNotifier = new MessageAdminTelegramNotifier(socketService, telegramNotifier);
  const userJoinedToolNotifier = new UserJoinedTelegramNotifier(telegramNotifier);
  eventBus.register(new SendMessageSocketHandler(adminNotifier));
  eventBus.register(new SendMessageSocketHandler(userNotifier));
  eventBus.register(new SendMessageToolHandler(messageToolNotifier));
  eventBus.register(new UserJoinedToolHandler(userJoinedToolNotifier));
}
  