import { randomUUID } from "node:crypto";
import { RecordId } from "surrealdb";
import type { Surreal } from "surrealdb";
import type { IDbExecutor } from "../../../../shared/database/db-executor.interface";
import { currentRequestId } from "../../../../shared/logging/log-context";
import type { PayloadMessage } from "../../domain/dtos/payloadMessage.dto";
import {
  MESSAGE_OUTBOX_EVENT_TYPE,
  type IMessageOutboxRepository,
  type MessageOutboxRecord,
} from "../../domain/message-outbox.repository";

type TMessageOutbox = Omit<MessageOutboxRecord, "id">;

export class MessageOutboxRepo implements IMessageOutboxRepository {
  constructor(private readonly pool: IDbExecutor<Surreal>) {}

  async ensureReady(): Promise<void> {
    await this.pool.execute(async (db) => {
      await db.query("DEFINE TABLE message_outbox SCHEMALESS").catch(() => {});
      await db
        .query(
          `
        DEFINE INDEX idx_status ON message_outbox FIELDS status;
        DEFINE INDEX idx_createdAt ON message_outbox FIELDS createdAt;
        DEFINE INDEX idx_eventId ON message_outbox FIELDS eventId UNIQUE;
      `,
        )
        .catch(() => {});
    });
  }

  async createMessageCreated(payload: PayloadMessage): Promise<void> {
    const eventId = randomUUID();
    const now = new Date();

    await this.pool.execute(async (db) => {
      await db
        .create<TMessageOutbox>(new RecordId("message_outbox", eventId))
        .content({
          eventId,
          type: MESSAGE_OUTBOX_EVENT_TYPE.MESSAGE_CREATED,
          payload: {
            ...payload,
            createdAt:
              payload.createdAt instanceof Date
                ? payload.createdAt.toISOString()
                : payload.createdAt,
          } as unknown as PayloadMessage,
          status: "pending",
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          nextAttemptAt: now,
          lockedUntil: null,
          processedAt: null,
          lastError: null,
          requestId: currentRequestId() ?? null,
        });
    });
  }

  async claimPending(limit: number, lockMs: number): Promise<MessageOutboxRecord[]> {
    return await this.pool.execute(async (db) => {
      const now = new Date();
      const candidates = await db.query<[Array<{ id: RecordId }>]>(
        `SELECT id, createdAt FROM message_outbox
         WHERE (status = "pending" AND (nextAttemptAt = NONE OR nextAttemptAt = NULL OR nextAttemptAt <= $now))
            OR (status = "processing" AND lockedUntil < $now)
         ORDER BY createdAt ASC
         LIMIT $limit`,
        { now, limit },
      );

      const claimed: MessageOutboxRecord[] = [];
      for (const candidate of candidates[0] ?? []) {
        const updated = await db.query<[MessageOutboxRecord[]]>(
          `UPDATE $id SET status = "processing", lockedUntil = $lockedUntil, updatedAt = $now
           WHERE (status = "pending" AND (nextAttemptAt = NONE OR nextAttemptAt = NULL OR nextAttemptAt <= $now))
              OR (status = "processing" AND lockedUntil < $now)
           RETURN AFTER`,
          {
            id: candidate.id,
            now,
            lockedUntil: new Date(now.getTime() + lockMs),
          },
        );
        const record = updated[0]?.[0];
        if (!record) continue;
        claimed.push({
          ...record,
          payload: {
            ...record.payload,
            createdAt: new Date(record.payload.createdAt),
          },
        });
      }
      return claimed;
    });
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.pool.execute(async (db) => {
      await db.query(
        `UPDATE message_outbox
         SET status = "processed",
             processedAt = time::now(),
             updatedAt = time::now(),
             lockedUntil = NULL,
             lastError = NULL
         WHERE eventId = $eventId`,
        { eventId },
      );
    });
  }

  async markFailed(eventId: string, error: unknown, retryAt: Date | null): Promise<void> {
    await this.pool.execute(async (db) => {
      await db.query(
        `UPDATE message_outbox
         SET status = $status,
             attempts += 1,
             nextAttemptAt = $retryAt,
             lockedUntil = NULL,
             updatedAt = time::now(),
             lastError = $lastError
         WHERE eventId = $eventId`,
        {
          eventId,
          status: retryAt ? "pending" : "failed",
          retryAt,
          lastError: error instanceof Error ? error.message : String(error),
        },
      );
    });
  }
}
