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

  // TEMP: Skip database setup for telegram testing
  // const { dbContext, uow } = await setupDatabase();
  const dbContext = null as any;
  const uow = null as any;

  // TEMP: Skip modules setup for telegram testing
  // const { eventBus, routes, sessionManager, messageApp } = await setupModules(
  //   dbContext,
  //   uow,
  // );
  const eventBus = null as any;
  const routes = [];
  const sessionManager = null as any;
  const messageApp = null as any;

  // TEMP: Skip routes for telegram testing
  // routes.forEach(({ path, router }) => {
  //   app.addRouter(router, path);
  // });

  // Start HTTP server
  const httpServer = app.start(Number(port));

  // TEMP: Skip socket setup for telegram testing
  // const { disposeRedis, socketService } = await setupSocket(
  //   httpServer,
  //   socketOpts,
  //   sessionManager,
  //   messageApp,
  // );
  const disposeRedis = null;
  const socketService = null as any;

  // TEMP: Skip cleanup for telegram testing
  // if (disposeRedis) {
  //   app.addCleanup(() => {
  //     void disposeRedis();
  //   });
  // }

  const { telegramNotifier, telegramBotListener } = telegramModule();

  // TEMP: Skip event handlers for telegram testing
  // setupEventHandlers(eventBus, socketService, telegramNotifier);

  void telegramBotListener.start();
  console.log("Server started with telegram module only");
}

main();
