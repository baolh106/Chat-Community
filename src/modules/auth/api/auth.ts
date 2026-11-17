import type { Request, RequestHandler, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { ErrorMessage } from "../../../shared/constants/error.constant";
import { getAuth } from "../../../shared/middleware/auth.middleware";
import { catchAsync } from "../../../shared/utils/catchAsync";
import { ForbiddenError } from "../../../shared/utils/error";
import { sendSuccess } from "../../../shared/utils/response";
import { parseInput } from "../../../shared/utils/validate";
import type { IAuthApplication } from "../application/auth.application.interface";
import {
  NICKNAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  ResponseMessage,
} from "../constants/constant";

const startSessionSchema = z.object({
  nickname: z
    .string({ required_error: ErrorMessage.NICKNAME_REQUIRED })
    .trim()
    .min(1, ErrorMessage.NICKNAME_REQUIRED)
    .max(NICKNAME_MAX_LENGTH, ErrorMessage.NICKNAME_TOO_LONG),
});

const adminLoginSchema = z.object({
  password: z
    .string({ required_error: ErrorMessage.PASSWORD_REQUIRED })
    .min(1, ErrorMessage.PASSWORD_REQUIRED)
    .max(PASSWORD_MAX_LENGTH),
});

const refreshSchema = z.object({
  refreshToken: z
    .string({ required_error: ErrorMessage.REFRESH_TOKEN_REQUIRED })
    .trim()
    .min(1, ErrorMessage.REFRESH_TOKEN_REQUIRED),
});

const endSessionParamsSchema = z.object({ userId: z.string().min(1) });

export class AuthAPI {
  constructor(
    private readonly _authApp: IAuthApplication,
    private readonly _requireAuth: RequestHandler,
  ) {}

  api() {
    const router = Router();

    // Start user session - user enters nickname only
    router.post(
      "/start",
      catchAsync(async (req: Request, res: Response) => {
        const { nickname } = parseInput(startSessionSchema, req.body);
        const result = await this._authApp.startUserSession({ nickname });
        sendSuccess(res, result, ResponseMessage.USER_SESSION_STARTED);
      }),
    );

    router.post(
      "/:userId/end",
      this._requireAuth,
      catchAsync(async (req: Request, res: Response) => {
        const { userId } = parseInput(endSessionParamsSchema, req.params);
        const claims = getAuth(res);
        if (claims.role !== "admin" && claims.userId !== userId) {
          throw new ForbiddenError(ErrorMessage.FORBIDDEN);
        }

        await this._authApp.endUserSession(
          claims.role === "admin" ? { role: "user", userId } : claims,
        );
        sendSuccess(res, { userId }, ResponseMessage.USER_SESSION_ENDED);
      }),
    );

    router.post(
      "/admin/login",
      catchAsync(async (req: Request, res: Response) => {
        const { password } = parseInput(adminLoginSchema, req.body);
        const clientKey = req.ip ?? req.socket.remoteAddress ?? "unknown";
        const result = await this._authApp.loginAdmin(password, clientKey);
        sendSuccess(res, result, ResponseMessage.ADMIN_LOGGED_IN);
      }),
    );

    // Refresh access token using refresh token
    router.post(
      "/refresh",
      catchAsync(async (req: Request, res: Response) => {
        const { refreshToken } = parseInput(refreshSchema, req.body);
        const result = await this._authApp.refreshToken(refreshToken);
        sendSuccess(res, result, ResponseMessage.TOKEN_REFRESHED);
      }),
    );

    return router;
  }
}
