import type { Request, Response } from "express";
import { Router } from "express";
import { ErrorMessage } from "../../../shared/constants/error.constant";
import { catchAsync } from "../../../shared/utils/catchAsync";
import { sendFailure, sendSuccess } from "../../../shared/utils/response";
import type { UserSessionStartRequest } from "../application/dtos/user-session.dto";
import type { IAuthApplication } from "../application/auth.application.interface";

export class AuthAPI {
  constructor(private readonly userSessionApp: IAuthApplication) {}

  api() {
    const router = Router();

    // Start user session - user enters nickname only
    router.post(
      "/start",
      catchAsync(async (req: Request, res: Response) => {
        const payload = req.body as UserSessionStartRequest;

        if (!payload.nickname || payload.nickname.trim().length === 0) {
          sendFailure(res, ErrorMessage.NICKNAME_REQUIRED);
        }

        const result = await this.userSessionApp.startUserSession(payload);

        sendSuccess(res, result, "User session started successfully");
      }),
    );

    // End user session
    router.post(
      "/:userId/end",
      catchAsync(async (req: Request, res: Response) => {
        await this.userSessionApp.endUserSession(req.params.userId as string);
        sendSuccess(res, { userId: req.params.userId }, "User session ended");
      }),
    );

    // Admin login
    router.post(
      "/admin/login",
      catchAsync(async (req: Request, res: Response) => {
        const { password } = req.body;
        if (!password || password.trim().length === 0) {
          sendFailure(res, ErrorMessage.PASSWORD_REQUIRED);
        }

        const result = await this.userSessionApp.loginAdmin(password);
        sendSuccess(res, result, "Admin logged in successfully");
      }),
    );

    return router;
  }
}
