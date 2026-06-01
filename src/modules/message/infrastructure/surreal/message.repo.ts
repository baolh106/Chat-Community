import { RecordId, Table, Uuid } from "surrealdb";
import type { IDbExecutor } from "../../../../shared/database/db-executor.interface";
import { BadRequestError } from "../../../../shared/utils/error";
import { ResponseMessage } from "../../constant/constant";
import type { PayloadMessage } from "../../domain/dtos/payloadMessage.dto";
import type { IMessageRepository } from "../../domain/mesage.repository";
import type { TMessage } from "../message.type";

export class MessageRepo implements IMessageRepository {
  constructor(private readonly pool: IDbExecutor) {}

  async create(payload: PayloadMessage): Promise<void> {
    const userId = new RecordId("messages", Uuid.v4());
    const result = await this.pool.execute(async (db) => {
      return await db
        .create<TMessage>(userId)
        .content({
          content: payload.content ?? null,
          imageURL: payload?.imageURL ?? null,
          fileURL: payload?.fileURL ?? null,
          fileDownloadURL: payload?.fileDownloadURL ?? null,
          fileName: payload?.fileName ?? null,
          fileMimeType: payload?.fileMimeType ?? null,
          fileSize: payload?.fileSize ?? null,
          fileDriveId: payload?.fileDriveId ?? null,
          attachmentType: payload?.attachmentType ?? null,
          createdAt: new Date(),
          sender: payload.sender,
          receiver: payload.receiver,
          isRead: payload.isRead ?? false,
        });
    });

    if (!result) {
      throw new BadRequestError(ResponseMessage.CREATE_MESSAGE_FAILED);
    }
  }

  async insertList(payload: PayloadMessage[]): Promise<void> {
    await this.pool.execute(async (db) => {
      await db
        .insert(
          new Table("messages"),
          payload.map((m) => ({
            content: m.content ?? null,
            imageURL: m?.imageURL ?? null,
            fileURL: m?.fileURL ?? null,
            fileDownloadURL: m?.fileDownloadURL ?? null,
            fileName: m?.fileName ?? null,
            fileMimeType: m?.fileMimeType ?? null,
            fileSize: m?.fileSize ?? null,
            fileDriveId: m?.fileDriveId ?? null,
            attachmentType: m?.attachmentType ?? null,
            createdAt: m.createdAt,
            sender: m.sender,
            receiver: m.receiver,
            isRead: m.isRead ?? false,
          })),
        )
        .output("none");
    });
  }
}
