import { Db } from "mongodb";
import { randomUUID } from "node:crypto";
import { MongoDbContext } from "../../../../config/database/mongoDBContext";
import type { IDbExecutor } from "../../../../shared/database/db-executor.interface";
import type { IMessageRepository } from "../../domain/mesage.repository";
import type { PayloadMessage } from "../../domain/dtos/payloadMessage.dto";
import { BadRequestError } from "../../../../shared/utils/error";
import { ResponseMessage } from "../../constant/constant";

export class MessageRepo implements IMessageRepository {
  constructor(private readonly pool: IDbExecutor<Db>) {}

  async ensureReady(): Promise<void> {
    await this.pool.execute(async (db) => {
      const collection = db.collection("messages");
      await collection.createIndex({ sender: 1 });
      await collection.createIndex({ receiver: 1 });
      await collection.createIndex({ createdAt: 1 });
    });
  }

  async create(payload: PayloadMessage): Promise<void> {
    await this.pool.execute(async (db) => {
      const session = MongoDbContext.currentSession;
      const doc = {
        _id: randomUUID(),
        ...payload,
        createdAt: payload.createdAt || new Date(),
        isRead: payload.isRead ?? false,
      };

      const result = await db.collection("messages").insertOne(doc as any, session ? { session } : {});
      
      if (!result.acknowledged) {
        throw new BadRequestError(ResponseMessage.CREATE_MESSAGE_FAILED);
      }
    });
  }

  async insertList(payload: PayloadMessage[]): Promise<void> {
    await this.pool.execute(async (db) => {
      const session = MongoDbContext.currentSession;
      const docs = payload.map(m => ({
        _id: randomUUID(),
        content: m.content ?? null,
        imageURL: m?.imageURL ?? null,
        fileURL: m?.fileURL ?? null,
        fileDownloadURL: m?.fileDownloadURL ?? null,
        fileName: m?.fileName ?? null,
        fileMimeType: m?.fileMimeType ?? null,
        fileSize: m?.fileSize ?? null,
        fileDriveId: m?.fileDriveId ?? null,
        attachmentType: m?.attachmentType ?? null,
        createdAt: m.createdAt || new Date(),
        sender: m.sender,
        receiver: m.receiver,
        isRead: m.isRead ?? false,
      }));

      await db.collection("messages").insertMany(docs as any, session ? { session } : {});
    });
  }
}