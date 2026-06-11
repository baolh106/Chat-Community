import type { IEventBusPublisher } from "../../../infrastructure/event-bus/application/event-bus-publisher.interface";
import { MessageCreatedEvent } from "../domain/events/message-created.event";
import type { IMessageOutboxRepository } from "../domain/message-outbox.repository";
import type { IMessageSessionCache } from "../infrastructure/cache/message-session.cache";
import type { MessageCreate } from "./dtos/param";

export type MessageOutboxWorkerOptions = {
  intervalMs?: number;
  batchSize?: number;
};

export class MessageOutboxWorker {
  private timer: NodeJS.Timeout | undefined;
  private isProcessing = false;
  private readonly intervalMs: number;
  private readonly batchSize: number;

  constructor(
    private readonly outboxRepo: IMessageOutboxRepository,
    private readonly eventBus: IEventBusPublisher,
    private readonly sessionCache?: IMessageSessionCache,
    options: MessageOutboxWorkerOptions = {},
  ) {
    this.intervalMs = options.intervalMs ?? 1000;
    this.batchSize = options.batchSize ?? 25;
  }

  async start(): Promise<void> {
    if (this.timer) {
      return;
    }

    // Đảm bảo table sẵn sàng trước khi bắt đầu polling vòng lặp đầu tiên
    try {
      await this.outboxRepo.ensureReady();
    } catch (err) {
      console.error("[MessageOutboxWorker] Failed to ensure repository readiness:", err);
    }

    void this.processPending();
    this.timer = setInterval(() => {
      void this.processPending();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = undefined;
  }

  async processPending(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      const events = await this.outboxRepo.getPending(this.batchSize);
      for (const event of events) {
        try {
          await this.eventBus.publish(new MessageCreatedEvent(event.payload));
          await this.appendCacheBestEffort(event.payload);
          await this.outboxRepo.markProcessed(event.eventId);
        } catch (error) {
          await this.outboxRepo.markFailed(event.eventId, error);
          console.error(
            `[MessageOutboxWorker] Failed to process event=${event.eventId}`,
            error,
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async appendCacheBestEffort(message: MessageCreate): Promise<void> {
    if (!this.sessionCache) {
      return;
    }

    const conversationKey =
      message.sender === "admin" ? message.receiver : message.sender;

    try {
      await this.sessionCache.appendMessage(conversationKey, message);
    } catch (error) {
      console.error(
        `[MessageOutboxWorker] Failed to append Redis session cache for conversation=${conversationKey}`,
        error,
      );
    }
  }
}
