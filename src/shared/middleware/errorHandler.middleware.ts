// src/infrastructure/middlewares/errorMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/error";
import { sendError } from "../utils/response";

/**
 * Not found handler (404)
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const err = new AppError(
    `Can't find ${req.originalUrl} on this server!`,
    404,
    "ROUTE_NOT_FOUND",
  );
  next(err);
};

/**
 * Global error handler
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let error = { ...err };
  error.message = err.message;

  if (err.message?.includes("Database index violation")) {
    error = new AppError(
      "Data already exists in the system!",
      400,
      "DUPLICATE_RECORD",
    );
  }

  if (err.name === "JsonWebTokenError") {
    error = new AppError(
      "Invalid token. Please log in again!",
      401,
      "INVALID_TOKEN",
    );
  }
  if (err.name === "TokenExpiredError") {
    error = new AppError("Your session has expired!", 401, "SESSION_EXPIRED");
  }

  if (err.name === "ZodError" || err.name === "ValidationError") {
    const detail = err.errors
      ? err.errors.map((i: any) => i.message).join(", ")
      : err.message;
    error = new AppError(
      `Validation failed: ${detail}`,
      400,
      "VALIDATION_ERROR",
    );
  }

  if (err.code === "ECONNREFUSED") {
    error = new AppError(
      "Service temporarily unavailable. Please try again later.",
      503,
      "SERVICE_UNAVAILABLE",
      false,
    );
  }

  if (!(error instanceof AppError)) {
    error = new AppError(
      error.message,
      err.statusCode || 500,
      err.errorCode || "INTERNAL_SERVER_ERROR",
      false,
    );
  }

  sendError(error, req, res);
};
