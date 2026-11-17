import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { MongoDbContext } from "../../../../config/database/mongoDBContext";
import type { IDbExecutor } from "../../../../shared/database/db-executor.interface";
import { BadRequestError } from "../../../../shared/utils/error";
import { ResponseMessage } from "../../constant/constant";
import type { PayloadMessage } from "../../domain/dtos/payloadMessage.dto";
import type { IMessageRepository } from "../../domain/mesage.repository";

type MessageDoc = Omit<PayloadMessage, "id"> & {
  _id: string;
  isRead: boolean;
};

function toDoc(payload: PayloadMessage): MessageDoc {
  const { id, ...rest } = payload;
  return {
    ...rest,
    _id: id ?? randomUUID(),
    content: payload.content ?? null,
    createdAt: payload.createdAt ?? new Date(),
    isRead: payload.isRead ?? false,
  };
}

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
      const result = await db
        .collection<MessageDoc>("messages")
        .insertOne(toDoc(payload), session ? { session } : {});

      if (!result.acknowledged) {
        throw new BadRequestError(ResponseMessage.CREATE_MESSAGE_FAILED);
      }
    });
  }

  async insertList(payload: PayloadMessage[]): Promise<void> {
    if (payload.length === 0) return;
    await this.pool.execute(async (db) => {
      const session = MongoDbContext.currentSession;
      await db
        .collection<MessageDoc>("messages")
        .insertMany(payload.map(toDoc), session ? { session } : {});
    });
  }
}
