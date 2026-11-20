import { randomUUID } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import { principalIdOf, type AuthClaims } from "../auth/auth-claims";
import { runWithLogContext } from "../logging/log-context";
import { createLogger } from "../logging/logger";
import type { LogFields } from "../logging/logger.interface";

export const REQUEST_ID_HEADER = "x-request-id";
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;
const IGNORED_PATHS = new Set(["/favicon.ico"]);

export const ERROR_LOCALS_KEY = "logError";

export type LoggedError = { code: string; message: string };

const logger = createLogger("http");

export function resolveRequestId(header: unknown): string {
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value) ? value : randomUUID();
}

function pathOf(req: Request): string {
  const url = req.originalUrl || req.url || "";
  const queryIndex = url.indexOf("?");
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

function requestFields(
  req: Request,
  res: Response,
  requestId: string,
  path: string,
  startedAt: bigint,
): LogFields {
  const claims = res.locals.auth as AuthClaims | undefined;
  const loggedError = res.locals[ERROR_LOCALS_KEY] as LoggedError | undefined;
  return {
    requestId,
    method: req.method,
    path,
    statusCode: res.statusCode,
    durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
    remoteAddress: req.ip,
    ...(claims && { userId: principalIdOf(claims), role: claims.role }),
    ...(loggedError && { errorCode: loggedError.code, errorMessage: loggedError.message }),
  };
}

export function createRequestLogger(): RequestHandler {
  return (req, res, next) => {
    const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const path = pathOf(req);
    if (!IGNORED_PATHS.has(path)) {
      const startedAt = process.hrtime.bigint();
      res.once("finish", () => {
        const fields = requestFields(req, res, requestId, path, startedAt);
        if (res.statusCode >= 500) {
          logger.error("request completed", fields);
        } else if (res.statusCode >= 400) {
          logger.warn("request completed", fields);
        } else {
          logger.info("request completed", fields);
        }
      });
      res.once("close", () => {
        if (!res.writableFinished) {
          logger.warn("request aborted", requestFields(req, res, requestId, path, startedAt));
        }
      });
    }

    runWithLogContext({ requestId }, next);
  };
}
