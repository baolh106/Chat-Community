import type { Router } from "express";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import {
  errorHandler,
  notFoundHandler,
} from "../middleware/errorHandler.middleware";

export class App {
  private app: express.Application;
  private _cleanup: () => void = () => {};
  private router: Router;
  private prefix: string = "";
  constructor() {
    this.app = express();
    this.app.use(
      cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
      }),
    );
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(compression());
    this.app.use(morgan("dev"));
    this.app.use(helmet());
    this.router = express.Router();
    this.app.use(this.router);
    this.router.get("/", (req, res) => {
      res.send("Hello World!");
    });
  }
  addPrefix(prefix: string) {
    this.prefix = prefix;
  }

  addRouter(router: express.Router, name: string = "/") {
    this.router.use(name, router);
  }

  addRouterWithMidleware(
    middleware: express.Handler,
    router: express.Router,
    name: string,
  ) {
    this.router.use(name, middleware, router);
  }

  addCleanup(cleanup: () => void) {
    this._cleanup = () => {
      this._cleanup;
      cleanup();
    };
  }

  start(port: number) {
    this.app.use(this.prefix, this.router);
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
    const server = this.app.listen(port, () => {
      console.log(`SERVER RUNNING ON PORT ${port}`);
    });
    process.on("SIGTERM", () => {
      this._cleanup();
      server.close();
    });
  }
}
