import type { IUnitOfWork } from "../../../infrastructure/IUnitOfWork";
import type { IEventBusPublisher } from "../../event-bus/application/event-bus-publisher.interface";
import { MessageCreatedEvent } from "../domain/events/message-created.event";
import type { IMessageRepository } from "../domain/mesage.repository";
import type { MessageCreate } from "./dtos/param";
import type { IMessageApplication } from "./message.application.interface";

export class MessageApplication implements IMessageApplication {
  constructor(
    private readonly _messageRepo: IMessageRepository,
    private readonly _uow: IUnitOfWork,
    private readonly _eventBus: IEventBusPublisher,
  ) {}

  public async create(message: MessageCreate) {
    await this._uow.runInTransaction(async () => {
      await this._messageRepo.create(message);
      await this._eventBus.publish(new MessageCreatedEvent(message));
    });
  }

  public async insertList(arrMessage: MessageCreate[]) {
    await this._uow.runInTransaction(async () => {
      await this._messageRepo.insertList(arrMessage);
      await Promise.all(
        arrMessage.map((m) =>
          this._eventBus.publish(new MessageCreatedEvent(m)),
        ),
      );
    });
  }
}
