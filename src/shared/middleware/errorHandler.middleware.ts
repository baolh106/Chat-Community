import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import type { IErrorAlerter } from "../alerting/error-alerter.interface";
import { ErrorCode } from "../constants/error.constant";
import { createLogger } from "../logging/logger";
import { AppError, NotFoundError } from "../utils/error";
import { sendError } from "../utils/response";
import { ERROR_LOCALS_KEY, type LoggedError } from "./request-logger.middleware";

const logger = createLogger("error-handler");

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  next(new NotFoundError(`Can't find ${req.originalUrl} on this server!`));
};

export function normalizeError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }

  const e = (err ?? {}) as Record<string, any>;
  const message = typeof e.message === "string" ? e.message : String(err);

  if (err instanceof ZodError) {
    const detail = err.issues.map((issue) => issue.message).join(", ");
    return new AppError(`Validation failed: ${detail}`, 400, "VALIDATION_ERROR");
  }
  if (e.name === "JsonWebTokenError") {
    return new AppError("Invalid token. Please log in again!", 401, ErrorCode.INVALID_TOKEN);
  }
  if (e.name === "TokenExpiredError") {
    return new AppError("Your session has expired!", 401, ErrorCode.SESSION_EXPIRED);
  }
  if (e.name === "MulterError") {
    const status = e.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return new AppError(message, status, "UPLOAD_ERROR");
  }
  if (e.code === 11000) {
    return new AppError("Data already exists in the system!", 409, "DUPLICATE_RECORD");
  }
  if (e.code === "ECONNREFUSED") {
    return new AppError(
      "Service temporarily unavailable. Please try again later.",
      503,
      ErrorCode.SERVICE_UNAVAILABLE,
      false,
    );
  }

  const status = Number(e.statusCode ?? e.status);
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return new AppError(
      e.expose === false ? "Bad request" : message,
      status,
      ErrorCode.BAD_REQUEST,
    );
  }

  const unknownError = new AppError(
    message || "Internal server error",
    500,
    ErrorCode.INTERNAL_SERVER_ERROR,
    false,
  );
  if (err instanceof Error && err.stack) {
    unknownError.stack = err.stack;
  }
  return unknownError;
}

export function isCriticalError(error: AppError): boolean {
  return !error.isOperational || error.statusCode >= 500;
}

export function createErrorHandler(alerter?: IErrorAlerter): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const error = normalizeError(err);

    if (res.locals) {
      const loggedError: LoggedError = { code: error.errorCode, message: error.message };
      res.locals[ERROR_LOCALS_KEY] = loggedError;
    }

    if (isCriticalError(error)) {
      logger.error("critical error", {
        err,
        statusCode: error.statusCode,
        errorCode: error.errorCode,
        method: req.method,
        url: req.originalUrl,
      });
      alerter?.alert({
        message: error.message,
        statusCode: error.statusCode,
        component: "API Error Handler",
        context: `${req.method} ${req.originalUrl}`,
      });
    }

    sendError(error, res);
  };
}
