import type { PayloadMessage } from "./dtos/payloadMessage.dto";

export const MESSAGE_OUTBOX_EVENT_TYPE = {
  MESSAGE_CREATED: "message.created",
} as const;

export type MessageOutboxEventType =
  (typeof MESSAGE_OUTBOX_EVENT_TYPE)[keyof typeof MESSAGE_OUTBOX_EVENT_TYPE];

export type MessageOutboxStatus = "pending" | "processing" | "processed" | "failed";

export type MessageOutboxRecord = {
  id?: unknown;
  eventId: string;
  type: MessageOutboxEventType;
  payload: PayloadMessage;
  status: MessageOutboxStatus;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
  nextAttemptAt?: Date | null;
  lockedUntil?: Date | null;
  processedAt?: Date | null;
  lastError?: string | null;
};

export interface IMessageOutboxRepository {
  ensureReady(): Promise<void>;
  createMessageCreated(payload: PayloadMessage): Promise<void>;
  claimPending(limit: number, lockMs: number): Promise<MessageOutboxRecord[]>;
  markProcessed(eventId: string): Promise<void>;
  markFailed(eventId: string, error: unknown, retryAt: Date | null): Promise<void>;
}
