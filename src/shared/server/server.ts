import type { Server as HttpServer } from "node:http";
import http from "node:http";
import type { Router } from "express";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { createLogger } from "../logging/logger";
import { corsAllowedOrigins, trustProxy } from "../../config/env";
import type { IErrorAlerter } from "../alerting/error-alerter.interface";
import {
  createErrorHandler,
  notFoundHandler,
} from "../middleware/errorHandler.middleware";
import {
  createRequestLogger,
  REQUEST_ID_HEADER,
} from "../middleware/request-logger.middleware";

const logger = createLogger("app");

type Cleanup = { name: string; fn: () => Promise<void> | void };

export type AppOptions = {
  errorAlerter?: IErrorAlerter;
  shutdownTimeoutMs?: number;
};

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

export class App {
  private readonly app: express.Application;
  private server?: HttpServer;
  private readonly cleanups: Cleanup[] = [];
  private readonly router: Router;
  private prefix: string = "";
  private shuttingDown = false;

  constructor(private readonly options: AppOptions = {}) {
    this.app = express();
    this.app.set("trust proxy", trustProxy);

    this.app.use(createRequestLogger());
    this.app.use(
      cors({
        origin: corsAllowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE"],
        exposedHeaders: [REQUEST_ID_HEADER],
      }),
    );
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(express.json({ limit: "1mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "1mb" }));

    this.router = express.Router();
    this.router.get("/", (_req, res) => {
      res.send("Hello World!");
    });
  }

  addPrefix(prefix: string) {
    this.prefix = prefix;
  }

  addRouter(router: express.Router, name: string = "/") {
    this.router.use(name, router);
  }

  addCleanup(name: string, fn: () => Promise<void> | void) {
    this.cleanups.push({ name, fn });
  }

  /** Trả về instance của HttpServer để cấu hình các dịch vụ như Socket.IO trước khi start. */
  getHttpServer(): HttpServer {
    if (!this.server) {
      this.server = http.createServer(this.app);
    }
    return this.server;
  }

  start(port: number): HttpServer {
    this.app.use(this.prefix || "/", this.router);
    this.app.use(notFoundHandler);
    this.app.use(createErrorHandler(this.options.errorAlerter));

    const server = this.getHttpServer();
    server.listen(port, () => {
      logger.info("server listening", { port });
    });

    for (const signal of SHUTDOWN_SIGNALS) {
      process.once(signal, () => {
        void this.shutdown(signal);
      });
    }
    return server;
  }

  async shutdown(reason: string): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    logger.info("shutting down", { reason });

    const timeoutMs = this.options.shutdownTimeoutMs ?? 10_000;
    const forceExit = setTimeout(() => {
      logger.error("shutdown timed out, forcing exit", { timeoutMs });
      process.exit(1);
    }, timeoutMs);
    forceExit.unref();

    const serverClosed = new Promise<void>((resolve) => {
      if (!this.server?.listening) {
        resolve();
        return;
      }
      this.server.close((err) => {
        if (err) logger.error("failed to close http server", { err });
        resolve();
      });
      this.server.closeIdleConnections?.();
    });

    for (const { name, fn } of [...this.cleanups].reverse()) {
      try {
        await fn();
      } catch (error) {
        logger.error("cleanup failed", { cleanup: name, err: error });
      }
    }

    await serverClosed;

    clearTimeout(forceExit);
    logger.info("shutdown complete");
    process.exit(0);
  }
}
