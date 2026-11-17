import type { IEventBusPublisher } from "../../../infrastructure/event-bus/application/event-bus-publisher.interface";
import { conversationKeyOf } from "../domain/conversation";
import { MessageCreatedEvent } from "../domain/events/message-created.event";
import type {
  IMessageOutboxRepository,
  MessageOutboxRecord,
} from "../domain/message-outbox.repository";
import type { IMessageSessionCache } from "./ports/message-session-cache.port";

export type MessageOutboxWorkerOptions = {
  intervalMs?: number;
  batchSize?: number;
  maxAttempts?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  lockMs?: number;
  now?: () => Date;
};

export class MessageOutboxWorker {
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> | null = null;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly lockMs: number;
  private readonly now: () => Date;

  constructor(
    private readonly outboxRepo: IMessageOutboxRepository,
    private readonly eventBus: IEventBusPublisher,
    private readonly sessionCache?: IMessageSessionCache,
    options: MessageOutboxWorkerOptions = {},
  ) {
    this.intervalMs = options.intervalMs ?? 1000;
    this.batchSize = options.batchSize ?? 25;
    this.maxAttempts = options.maxAttempts ?? 10;
    this.baseBackoffMs = options.baseBackoffMs ?? 1000;
    this.maxBackoffMs = options.maxBackoffMs ?? 5 * 60 * 1000;
    this.lockMs = options.lockMs ?? 60 * 1000;
    this.now = options.now ?? (() => new Date());
  }

  async start(): Promise<void> {
    if (this.timer) {
      return;
    }

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

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.running;
  }

  async processPending(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = this.processBatch().finally(() => {
      this.running = null;
    });
    await this.running;
  }

  backoffMs(attempt: number): number {
    const exp = this.baseBackoffMs * 2 ** Math.max(0, attempt - 1);
    return Math.min(this.maxBackoffMs, exp);
  }

  private async processBatch(): Promise<void> {
    let events: MessageOutboxRecord[];
    try {
      events = await this.outboxRepo.claimPending(this.batchSize, this.lockMs);
    } catch (error) {
      console.error("[MessageOutboxWorker] Failed to claim pending events:", error);
      return;
    }

    for (const event of events) {
      await this.processOne(event);
    }
  }

  private async processOne(event: MessageOutboxRecord): Promise<void> {
    try {
      await this.eventBus.publish(new MessageCreatedEvent(event.payload, event.eventId));
      await this.appendCacheBestEffort(event);
      await this.outboxRepo.markProcessed(event.eventId);
    } catch (error) {
      const attempt = (event.attempts ?? 0) + 1;
      const isDead = attempt >= this.maxAttempts;
      const retryAt = isDead
        ? null
        : new Date(this.now().getTime() + this.backoffMs(attempt));

      console.error(
        `[MessageOutboxWorker] Failed to process event=${event.eventId} attempt=${attempt}/${this.maxAttempts}` +
          (isDead ? " → dead-letter" : ` → retry at ${retryAt!.toISOString()}`),
        error,
      );

      try {
        await this.outboxRepo.markFailed(event.eventId, error, retryAt);
      } catch (markError) {
        console.error(
          `[MessageOutboxWorker] Failed to record failure for event=${event.eventId}`,
          markError,
        );
      }
    }
  }

  private async appendCacheBestEffort(event: MessageOutboxRecord): Promise<void> {
    if (!this.sessionCache) {
      return;
    }

    const message = {
      ...event.payload,
      id: event.payload.id ?? event.eventId,
    };
    const conversationKey = conversationKeyOf(message);

    try {
      await this.sessionCache.appendMessages(conversationKey, [message]);
    } catch (error) {
      console.error(
        `[MessageOutboxWorker] Failed to append Redis session cache for conversation=${conversationKey}`,
        error,
      );
    }
  }
}
