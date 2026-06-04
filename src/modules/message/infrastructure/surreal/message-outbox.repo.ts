import { RecordId, Table, Uuid } from "surrealdb";
import type { IDbExecutor } from "../../../../shared/database/db-executor.interface";
import type {
  IMessageOutboxRepository,
  MessageOutboxRecord,
} from "../../domain/message-outbox.repository";
import { MESSAGE_OUTBOX_EVENT_TYPE } from "../../domain/message-outbox.repository";
import type { MessageCreate } from "../../application/dtos/param";

type TMessageOutbox = Omit<MessageOutboxRecord, "id">;

export class MessageOutboxRepo implements IMessageOutboxRepository {
  constructor(private readonly pool: IDbExecutor) {}

  async ensureReady(): Promise<void> {
    await this.pool.execute(async (db) => {
      // Đảm bảo table tồn tại (SCHEMALESS)
      await db.query("DEFINE TABLE message_outbox SCHEMALESS").catch(() => {});

      // Định nghĩa index để tối ưu truy vấn cho Worker (status và createdAt)
      await db.query(`
        DEFINE INDEX idx_status ON message_outbox FIELDS status;
        DEFINE INDEX idx_createdAt ON message_outbox FIELDS createdAt;
      `).catch(() => {});
      
      console.log("[MessageOutboxRepo] Table 'message_outbox' is ready.");
    });
  }

  async createMessageCreated(payload: MessageCreate): Promise<void> {
    const eventId = Uuid.v4().toString();
    const recordId = new RecordId("message_outbox", eventId);
    const now = new Date();

    await this.pool.execute(async (db) => {
      await db
        .create<TMessageOutbox>(recordId)
        .content({
          eventId,
          type: MESSAGE_OUTBOX_EVENT_TYPE.MESSAGE_CREATED,
          payload: {
            ...payload,
            createdAt:
              payload.createdAt instanceof Date
                ? payload.createdAt.toISOString()
                : payload.createdAt,
          } as unknown as MessageCreate,
          status: "pending",
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          processedAt: null,
          lastError: null,
        })
        .then(() => undefined);
    });
  }

  async getPending(limit: number): Promise<MessageOutboxRecord[]> {
    return await this.pool.execute(async (db) => {
      try {
        const result = await db.query<[MessageOutboxRecord[]]>(
          `SELECT * FROM message_outbox
           WHERE status = "pending"
           ORDER BY createdAt ASC
           LIMIT $limit`,
          { limit },
        );

        return (result[0] ?? []).map((record) => ({
          ...record,
          payload: {
            ...record.payload,
            createdAt:
              record.payload.createdAt instanceof Date
                ? record.payload.createdAt
                : new Date(record.payload.createdAt),
          },
        }));
      } catch (error: any) {
        // Kiểm tra nếu lỗi do bảng chưa tồn tại
        if (String(error).toLowerCase().includes("table 'message_outbox' does not exist")) {
          // Định nghĩa bảng để tránh lỗi cho các lần polling tiếp theo
          await db.query("DEFINE TABLE message_outbox SCHEMALESS").catch(() => {});
          // Trả về batch rỗng như yêu cầu
          return [];
        }
        throw error;
      }
    });
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.pool.execute(async (db) => {
      await db.query(
        `UPDATE message_outbox
         SET status = "processed",
             processedAt = time::now(),
             updatedAt = time::now(),
             lastError = null
         WHERE eventId = $eventId`,
        { eventId },
      );
    });
  }

  async markFailed(eventId: string, error: unknown): Promise<void> {
    await this.pool.execute(async (db) => {
      await db.query(
        `UPDATE message_outbox
         SET status = "pending",
             attempts += 1,
             updatedAt = time::now(),
             lastError = $lastError
         WHERE eventId = $eventId`,
        {
          eventId,
          lastError: this.formatError(error),
        },
      );
    });
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
