import type { IUnitOfWork } from "../../../infrastructure/IUnitOfWork";
import type { IMessageRepository } from "../domain/mesage.repository";
import type { MessageCreate } from "./dtos/param";
import type { IMessageApplication } from "./message.application.interface";

export class MessageApplication implements IMessageApplication {
  constructor(
    private readonly _messageRepo: IMessageRepository,
    private readonly _uow: IUnitOfWork,
  ) {}

  public async create(message: MessageCreate) {
    await this._messageRepo.create(message);
  }

  public async insertList(arrMessage: MessageCreate[]) {
    return await this._uow.runInTransaction(async () => {
      await this._messageRepo.insertList(arrMessage);
    });
  }
}
