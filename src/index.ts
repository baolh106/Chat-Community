import "./config/env";

import {
  setupDatabase,
  setupEventHandlers,
  setupModules,
  setupSocket,
} from "./bootstrap";
import {
  corsAllowedOrigins,
  port,
  redisSocketIoKey,
  redisUrl,
  socketMaxHttpBufferBytes,
  uploadMaxFileSizeMb,
  uploadMaxFilesPerMessage,
} from "./config/env";
import { redisClient } from "./infrastructure/redis";
import { telegramModule } from "./infrastructure/telegram/presentation/telegram.module";
import { App } from "./shared/server/server";

async function main() {
  const telegram = telegramModule();
  const app = new App({ errorAlerter: telegram.errorAlerter });
  app.addPrefix("/api");

  const db = await setupDatabase();
  app.addCleanup("mongo", db.close);
  app.addCleanup("redis", () => redisClient.disconnect());

  const { eventBus, routes, tokenVerifier, sessionManager, messageApp, messageOutboxWorker } =
    await setupModules(db.dbContext, db.uow, redisClient);

  routes.forEach(({ path, router }) => {
    app.addRouter(router, path);
  });

  const socket = await setupSocket(
    app.getHttpServer(),
    {
      redisUrl,
      redisKey: redisSocketIoKey,
      corsOrigin: corsAllowedOrigins,
      maxHttpBufferSize: socketMaxHttpBufferBytes,
      maxFileSizeBytes: uploadMaxFileSizeMb * 1024 * 1024,
      maxFilesPerMessage: uploadMaxFilesPerMessage,
    },
    { sessionManager, messageApplication: messageApp, eventBus, tokenVerifier },
  );

  setupEventHandlers(
    eventBus,
    socket.socketService,
    telegram.telegramNotifier,
    telegram.telegramCallService,
  );

  await messageOutboxWorker.start();
  app.addCleanup("telegram-bot", () => telegram.telegramBotListener.stop());
  app.addCleanup("outbox-worker", () => messageOutboxWorker.stop());
  app.addCleanup("session-timers", () => sessionManager.dispose());
  app.addCleanup("socket", socket.close);

  // Start listening sau khi mọi thứ đã sẵn sàng
  app.start(Number(port));

  void telegram.telegramBotListener.start().catch((error) => {
    console.error("[TelegramBotListener] Bot stopped with error:", error);
  });
  console.log("Server started with database, socket and telegram modules");
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
