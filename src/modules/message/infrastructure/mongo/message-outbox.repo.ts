import { randomUUID } from "node:crypto";
import type { Db, Filter } from "mongodb";
import { MongoDbContext } from "../../../../config/database/mongoDBContext";
import type { IDbExecutor } from "../../../../shared/database/db-executor.interface";
import { currentRequestId } from "../../../../shared/logging/log-context";
import type { PayloadMessage } from "../../domain/dtos/payloadMessage.dto";
import {
  MESSAGE_OUTBOX_EVENT_TYPE,
  type IMessageOutboxRepository,
  type MessageOutboxRecord,
} from "../../domain/message-outbox.repository";

const COLLECTION = "message_outbox";
const PROCESSED_RETENTION_SECONDS = 7 * 24 * 60 * 60;

type OutboxDoc = Omit<MessageOutboxRecord, "id">;

export class MessageOutboxRepo implements IMessageOutboxRepository {
  constructor(private readonly pool: IDbExecutor<Db>) {}

  async ensureReady(): Promise<void> {
    await this.pool.execute(async (db) => {
      const collection = db.collection<OutboxDoc>(COLLECTION);
      await collection.createIndex({ eventId: 1 }, { unique: true });
      await collection.createIndex({ status: 1, nextAttemptAt: 1, createdAt: 1 });
      await collection.createIndex({ status: 1, lockedUntil: 1 });
      await collection.createIndex(
        { processedAt: 1 },
        {
          name: "processed_ttl",
          expireAfterSeconds: PROCESSED_RETENTION_SECONDS,
          partialFilterExpression: { status: "processed" },
        },
      );
    });
  }

  async createMessageCreated(payload: PayloadMessage): Promise<void> {
    const now = new Date();
    const doc: OutboxDoc = {
      eventId: randomUUID(),
      type: MESSAGE_OUTBOX_EVENT_TYPE.MESSAGE_CREATED,
      payload: {
        ...payload,
        createdAt:
          payload.createdAt instanceof Date
            ? payload.createdAt
            : new Date(payload.createdAt),
      },
      status: "pending",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      nextAttemptAt: now,
      lockedUntil: null,
      processedAt: null,
      lastError: null,
      requestId: currentRequestId() ?? null,
    };

    await this.pool.execute(async (db) => {
      const session = MongoDbContext.currentSession;
      await db
        .collection<OutboxDoc>(COLLECTION)
        .insertOne(doc, session ? { session } : {});
    });
  }

  async claimPending(limit: number, lockMs: number): Promise<MessageOutboxRecord[]> {
    return await this.pool.execute(async (db) => {
      const collection = db.collection<OutboxDoc>(COLLECTION);
      const claimed: MessageOutboxRecord[] = [];

      for (let i = 0; i < limit; i++) {
        const now = new Date();
        const filter: Filter<OutboxDoc> = {
          $or: [
            { status: "pending", nextAttemptAt: { $lte: now } },
            { status: "pending", nextAttemptAt: null },
            { status: "processing", lockedUntil: { $lt: now } },
          ],
        };
        const doc = await collection.findOneAndUpdate(
          filter,
          {
            $set: {
              status: "processing",
              lockedUntil: new Date(now.getTime() + lockMs),
              updatedAt: now,
            },
          },
          { sort: { createdAt: 1 }, returnDocument: "after" },
        );
        if (!doc) break;

        const { _id, ...rest } = doc;
        claimed.push({
          ...rest,
          id: _id.toString(),
          payload: {
            ...rest.payload,
            createdAt: new Date(rest.payload.createdAt),
          },
        });
      }
      return claimed;
    });
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.pool.execute(async (db) => {
      const now = new Date();
      await db.collection<OutboxDoc>(COLLECTION).updateOne(
        { eventId },
        {
          $set: {
            status: "processed",
            processedAt: now,
            updatedAt: now,
            lockedUntil: null,
            lastError: null,
          },
        },
      );
    });
  }

  async markFailed(eventId: string, error: unknown, retryAt: Date | null): Promise<void> {
    await this.pool.execute(async (db) => {
      await db.collection<OutboxDoc>(COLLECTION).updateOne(
        { eventId },
        {
          $set: {
            status: retryAt ? "pending" : "failed",
            nextAttemptAt: retryAt,
            lockedUntil: null,
            updatedAt: new Date(),
            lastError: error instanceof Error ? error.message : String(error),
          },
          $inc: { attempts: 1 },
        },
      );
    });
  }
}
