import type { Response } from "express";
import { isProduction } from "../../config/env";
import { ErrorCode, ErrorMessage } from "../constants/error.constant";
import type { AppError } from "./error";

export const sendSuccess = (
  res: Response,
  data: unknown,
  message: string = "Successful",
  statusCode: number = 200,
  meta: unknown = null,
): void => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
};

export const sendError = (err: AppError, res: Response): void => {
  if (res.headersSent) {
    return;
  }

  const statusCode = err.statusCode || 500;
  const hideDetail = isProduction && statusCode >= 500;

  res.status(statusCode).json({
    success: false,
    code: err.errorCode || ErrorCode.INTERNAL_SERVER_ERROR,
    message: hideDetail
      ? ErrorMessage.SOMETHING_WENT_WRONG
      : err.message || ErrorMessage.SOMETHING_WENT_WRONG,
    ...(!isProduction ? { stack: err.stack } : {}),
  });
};
