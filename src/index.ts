import "./config/env";

import { surrealConfig } from "./config/database/database";
import { SurrealDbContext } from "./config/database/surrealDBContext";
import { connectDB } from "./shared/database/surrealDB.connect";
import { App } from "./shared/server/server";
import {
  adminSocketSecret,
  port,
  redisSocketIoKey,
  redisUrl,
  userSocketSecret,
} from "./config/env";
import { UnitOfWorkSurreal } from "./infrastructure/UnitOfWork-SurrealDB";
import { messageModule } from "./modules/message/presentation/message.module";
import { eventBusModule } from "./modules/event-bus/presentation/event-bus.module";
import { MessageCreatedAdminSocketHandler } from "./modules/message/application/handlers/message-created-admin-socket.handler";
import { MessageAdminSocketNotifier } from "./modules/message/infrastructure/realtime/message-admin-socket.notifier";
import {
  setupSocketServer,
  type AttachSocketServerOptions,
} from "./modules/socket/presentation/socket.module";

async function main() {
  const app = new App();
  app.addPrefix("/api");

  const { eventBus } = eventBusModule();

  // Connect DB
  const db = await connectDB(surrealConfig);
  const dbContext = new SurrealDbContext(db);
  const uow = new UnitOfWorkSurreal(dbContext);

  // Message Router
  // API Routes
  app.addRouter(
    messageModule(dbContext, uow, eventBus).messageApi.api(),
    "/message",
  );

  const httpServer = app.start(Number(port));
  const socketOpts: AttachSocketServerOptions = {
    adminJoinSecret: adminSocketSecret,
    userJoinSecret: userSocketSecret,
  };
  if (redisUrl) {
    socketOpts.redisUrl = redisUrl;
    if (redisSocketIoKey.length > 0) {
      socketOpts.redisKey = redisSocketIoKey;
    }
  }
  const { disposeRedis, socketService } = await setupSocketServer(
    httpServer,
    socketOpts,
  );
  if (disposeRedis) {
    app.addCleanup(() => {
      void disposeRedis();
    });
  }
  const adminNotifier = new MessageAdminSocketNotifier(socketService);
  eventBus.register(new MessageCreatedAdminSocketHandler(adminNotifier));

  if (!adminSocketSecret) {
    console.warn(
      "[socket] ADMIN_SOCKET_SECRET is empty — admin:join will be rejected until you set it in .env",
    );
  }
  if (!userSocketSecret) {
    console.warn(
      "[socket] USER_SOCKET_SECRET is empty — user:join will be rejected until you set it in .env",
    );
  }
}

main();
