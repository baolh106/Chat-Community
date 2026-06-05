import { Db, type Sort } from "mongodb";
import { MongoDbContext } from "../../../../config/database/mongoDBContext";
import type { IDbExecutor } from "../../../../shared/database/db-executor.interface";
import type { 
  IMessageOutboxRepository, 
  MessageOutboxRecord 
} from "../../domain/message-outbox.repository";
import { MESSAGE_OUTBOX_EVENT_TYPE } from "../../domain/message-outbox.repository";
import type { MessageCreate } from "../../application/dtos/param";
import { randomUUID } from "node:crypto";

export class MessageOutboxRepo implements IMessageOutboxRepository {
  constructor(private readonly pool: IDbExecutor<Db>) {}

  async ensureReady(): Promise<void> {
    await this.pool.execute(async (db) => {
      const collection = db.collection("message_outbox");
      await collection.createIndex({ status: 1 });
      await collection.createIndex({ createdAt: 1 });
      await collection.createIndex({ eventId: 1 }, { unique: true });
    });
  }

  async createMessageCreated(payload: MessageCreate): Promise<void> {
    const eventId = randomUUID();
    const now = new Date();

    await this.pool.execute(async (db) => {
      const session = MongoDbContext.currentSession;
      await db.collection("message_outbox").insertOne({
        eventId,
        type: MESSAGE_OUTBOX_EVENT_TYPE.MESSAGE_CREATED,
        payload: {
          ...payload,
          createdAt: payload.createdAt instanceof Date 
            ? payload.createdAt 
            : new Date(payload.createdAt)
        },
        status: "pending",
        attempts: 0,
        createdAt: now,
        updatedAt: now,
        processedAt: null,
        lastError: null,
      }, session ? { session } : {});
    });
  }

  async getPending(limit: number): Promise<MessageOutboxRecord[]> {
    return await this.pool.execute(async (db) => {
      const cursor = db.collection("message_outbox")
        .find({ status: "pending" })
        .sort({ createdAt: 1 } as Sort)
        .limit(limit);

      const results = await cursor.toArray();
      return results.map(doc => ({
        ...doc,
        id: doc._id.toString(),
      })) as unknown as MessageOutboxRecord[];
    });
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.pool.execute(async (db) => {
      const session = MongoDbContext.currentSession;
      await db.collection("message_outbox").updateOne(
        { eventId },
        {
          $set: {
            status: "processed",
            processedAt: new Date(),
            updatedAt: new Date(),
            lastError: null
          }
        },
        session ? { session } : {}
      );
    });
  }

  async markFailed(eventId: string, error: unknown): Promise<void> {
    await this.pool.execute(async (db) => {
      const session = MongoDbContext.currentSession;
      await db.collection("message_outbox").updateOne(
        { eventId },
        {
          $set: {
            status: "pending",
            updatedAt: new Date(),
            lastError: error instanceof Error ? error.message : String(error)
          },
          $inc: { attempts: 1 }
        },
        session ? { session } : {}
      );
    });
  }
}