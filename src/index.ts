import "./config/env";

import { App } from "./shared/server/server";
import { port, redisSocketIoKey, redisUrl } from "./config/env";
import {
  setupDatabase,
  setupModules,
  setupSocket,
  setupEventHandlers,
} from "./bootstrap";
import { telegramModule } from "./infrastructure/telegram/presentation/telegram.module";
import type { AttachSocketServerOptions } from "./infrastructure/socket/infrastructure/attach-socket-server";

async function main() {
  const app = new App();
  app.addPrefix("/api");

  const { dbContext, uow } = await setupDatabase();
  const { eventBus, routes, sessionManager, messageApp } = await setupModules(
    dbContext,
    uow,
  );

  routes.forEach(({ path, router }) => {
    app.addRouter(router, path);
  });

  const httpServer = app.start(Number(port));

  const socketOpts: AttachSocketServerOptions = {
    redisUrl,
    redisKey: redisSocketIoKey,
  };
  const { disposeRedis, socketService } = await setupSocket(
    httpServer,
    socketOpts,
    sessionManager,
    messageApp,
    eventBus,
  );

  if (disposeRedis) {
    app.addCleanup(() => {
      void disposeRedis();
    });
  }

  const { telegramNotifier, telegramBotListener } = telegramModule();
  setupEventHandlers(eventBus, socketService, telegramNotifier);

  void telegramBotListener.start();
  console.log("Server started with database, socket and telegram modules");
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
