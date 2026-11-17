import type { Server as HttpServer } from "node:http";
import http from "node:http";
import type { Router } from "express";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { corsAllowedOrigins, isProduction, trustProxy } from "../../config/env";
import type { IErrorAlerter } from "../alerting/error-alerter.interface";
import {
  createErrorHandler,
  notFoundHandler,
} from "../middleware/errorHandler.middleware";

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

    this.app.use(
      cors({
        origin: corsAllowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE"],
      }),
    );
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(morgan(isProduction ? "combined" : "dev"));
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
      console.log(`SERVER RUNNING ON PORT ${port}`);
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
    console.log(`[App] Shutting down (${reason})...`);

    const timeoutMs = this.options.shutdownTimeoutMs ?? 10_000;
    const forceExit = setTimeout(() => {
      console.error(`[App] Shutdown timed out after ${timeoutMs}ms, forcing exit`);
      process.exit(1);
    }, timeoutMs);
    forceExit.unref();

    const serverClosed = new Promise<void>((resolve) => {
      if (!this.server?.listening) {
        resolve();
        return;
      }
      this.server.close((err) => {
        if (err) console.error("[App] Error closing HTTP server:", err);
        resolve();
      });
      this.server.closeIdleConnections?.();
    });

    for (const { name, fn } of [...this.cleanups].reverse()) {
      try {
        await fn();
      } catch (error) {
        console.error(`[App] Cleanup "${name}" failed:`, error);
      }
    }

    await serverClosed;

    clearTimeout(forceExit);
    console.log("[App] Shutdown complete");
    process.exit(0);
  }
}
