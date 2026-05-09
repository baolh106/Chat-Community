import type { Request, Response } from "express";
import { ErrorCode, ErrorMessage } from "../constants/error.constant";
import type { AppError } from "./error";
import { createTelegramNotifier } from "../../infrastructure/telegram/infrastructure/telegram.notifier";
import { getTemplate } from "../../infrastructure/telegram/telegram-templates";

export const sendSuccess = (
  res: any,
  data: any,
  message: string = "Successful",
  statusCode: number = 200,
  meta: any = null,
) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta && { meta }),
  });
};

export const sendFailure = (
  res: any,
  message: string,
  statusCode: number = 400,
  errorCode: string = ErrorCode.BAD_REQUEST,
) => {
  res.status(statusCode).json({
    success: false,
    code: errorCode,
    message,
  });
};

export const sendError = (err: AppError, req: Request, res: Response) => {
  const statusCode = err.statusCode || 500;

  // Log system errors for Admin (500)
  if (!err.isOperational) {
    console.error(" [SYSTEM_CRITICAL_ERROR] ", err);
    // Send Telegram alert for critical errors
    notifyErrorViaTelegram(err, req, statusCode);
  }

  res.status(statusCode).json({
    success: false,
    code: err.errorCode || ErrorCode.INTERNAL_SERVER_ERROR,
    message: err.message || ErrorMessage.SOMETHING_WENT_WRONG,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

async function notifyErrorViaTelegram(err: AppError, req: Request, statusCode: number): Promise<void> {
  try {
    const telegramNotifier = createTelegramNotifier();
    const { text, parseMode } = getTemplate("errorNotification", {
      error: err.message,
      component: "API Error Handler",
      severity: statusCode >= 500 ? "Critical" : "High",
      context: `${req.method} ${req.originalUrl}`,
    });
    
    await telegramNotifier.sendMessage(text, { parseMode });
  } catch (err) {
    console.error("[TelegramNotification] Failed to send error alert:", err);
  }
}
