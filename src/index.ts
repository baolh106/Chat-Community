import "./config/env";

import { App } from "./shared/server/server";
import { port, redisSocketIoKey, redisUrl } from "./config/env";
import {
  setupDatabase,
  setupModules,
  setupSocket,
  setupEventHandlers,
} from "./bootstrap";
import type { AttachSocketServerOptions } from "./infrastructure/socket/infrastructure/attach-socket-server";

async function main() {
  const app = new App();
  app.addPrefix("/api");

  // Setup database
  const { dbContext, uow } = await setupDatabase();

  // Setup modules and route list
  const { eventBus, routes, sessionManager, messageApp } = await setupModules(
    dbContext,
    uow,
  );

  routes.forEach(({ path, router }) => {
    app.addRouter(router, path);
  });

  // Start HTTP server
  const httpServer = app.start(Number(port));

  // Setup socket server
  const socketOpts: AttachSocketServerOptions = {};
  if (redisUrl) {
    socketOpts.redisUrl = redisUrl;
    if (redisSocketIoKey.length > 0) {
      socketOpts.redisKey = redisSocketIoKey;
    }
  }
  const { disposeRedis, socketService } = await setupSocket(
    httpServer,
    socketOpts,
    sessionManager,
    messageApp,
  );
  if (disposeRedis) {
    app.addCleanup(() => {
      void disposeRedis();
    });
  }

  // Register event handlers
  setupEventHandlers(eventBus, socketService);
}

main();
