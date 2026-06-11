import type { MessageCreate } from "../application/dtos/param";

export const MESSAGE_OUTBOX_EVENT_TYPE = {
  MESSAGE_CREATED: "message.created",
} as const;

export type MessageOutboxEventType =
  (typeof MESSAGE_OUTBOX_EVENT_TYPE)[keyof typeof MESSAGE_OUTBOX_EVENT_TYPE];

export type MessageOutboxStatus = "pending" | "processing" | "processed";

export type MessageOutboxRecord = {
  id?: unknown;
  eventId: string;
  type: MessageOutboxEventType;
  payload: MessageCreate;
  status: MessageOutboxStatus;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date | null;
  lastError?: string | null;
};

export interface IMessageOutboxRepository {
  ensureReady(): Promise<void>;
  createMessageCreated(payload: MessageCreate): Promise<void>;
  getPending(limit: number): Promise<MessageOutboxRecord[]>;
  markProcessed(eventId: string): Promise<void>;
  markFailed(eventId: string, error: unknown): Promise<void>;
}
