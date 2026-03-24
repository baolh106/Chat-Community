import { Router } from "express";
import type { IMessageApplication } from "../application/message.application.interface";
import { catchAsync } from "../../../shared/utils/catchAsync";
import type { MessageCreate } from "../application/dtos/param";
import { sendSuccess } from "../../../shared/utils/response";
import { ResponseMessage } from "../constant/constant";
import type { Request, Response } from "express";

export class MessageAPI {
  constructor(private readonly _messageApp: IMessageApplication) {}

  api() {
    const router = Router();
    router.post(
      "/insert",
      catchAsync(async (req: Request, res: Response) => {
        const payload = req.body as MessageCreate;
        await this._messageApp.create(payload);
        sendSuccess(res, "", ResponseMessage.CREATE_MESSAGE_SUCCESSFUL);
      }),
    );

    router.post(
      "/insert-list",
      catchAsync(async (req: Request, res: Response) => {
        const payload = req.body as MessageCreate[];
        await this._messageApp.insertList(payload);
        sendSuccess(res, "", ResponseMessage.CREATE_MESSAGE_SUCCESSFUL);
      }),
    );

    return router;
  }
}
