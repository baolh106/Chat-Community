import { RecordId, Table, Uuid } from "surrealdb";
import type { SurrealDbContext } from "../../../../config/database/surrealDBContext";
import { BadRequestError } from "../../../../shared/utils/error";
import { ResponseMessage } from "../../constant/constant";
import type { PayloadMessage } from "../../domain/dtos/payloadMessage.dto";
import type { IMessageRepository } from "../../domain/mesage.repository";
import type { TMessage } from "../message.type";

export class MessageRepo implements IMessageRepository {
  constructor(private readonly pool: SurrealDbContext) {}
  async create(payload: PayloadMessage): Promise<void> {
    const userId = new RecordId("messages", Uuid.v4());
    const result = await this.pool
      .getDB()
      .create<TMessage>(userId)
      .content({
        content: payload.content,
        imageURL: payload?.imageURL ?? null,
        createdAt: new Date(),
        sender: payload.sender,
        receiver: payload.receiver,
      });

    if (!result) {
      throw new BadRequestError(ResponseMessage.CREATE_MESSAGE_FAILED);
    }
  }

  async insertList(payload: PayloadMessage[]): Promise<void> {
    await this.pool
      .getDB()
      .insert(
        new Table("messages"),
        payload.map((m) => ({
          content: m.content,
          imageURL: m?.imageURL ?? null,
          createdAt: m.createdAt,
          sender: m.sender,
          receiver: m.receiver,
        })),
      )
      .output("none");
  }
}
