import type { IEventBusPublisher } from "../../../infrastructure/event-bus/application/event-bus-publisher.interface";
import { conversationKeyOf } from "../domain/conversation";
import { MessageCreatedEvent } from "../domain/events/message-created.event";
import type {
  IMessageOutboxRepository,
  MessageOutboxRecord,
} from "../domain/message-outbox.repository";
import { runWithLogContext } from "../../../shared/logging/log-context";
import { createLogger } from "../../../shared/logging/logger";
import type { IMessageSessionCache } from "./ports/message-session-cache.port";

const logger = createLogger("outbox-worker");

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
      logger.error("outbox repository readiness check failed", { err });
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
      logger.error("failed to claim pending outbox events", { err: error });
      return;
    }

    if (events.length > 0) {
      logger.debug("claimed outbox events", { count: events.length });
    }

    for (const event of events) {
      await this.processOne(event);
    }
  }

  private async processOne(event: MessageOutboxRecord): Promise<void> {
    await runWithLogContext(
      {
        requestId: event.requestId ?? undefined,
        eventId: event.eventId,
        eventType: event.type,
      },
      () => this.processInContext(event),
    );
  }

  private async processInContext(event: MessageOutboxRecord): Promise<void> {
    const startedAt = Date.now();
    try {
      await this.eventBus.publish(new MessageCreatedEvent(event.payload, event.eventId));
      await this.appendCacheBestEffort(event);
      await this.outboxRepo.markProcessed(event.eventId);
      logger.info("outbox event processed", {
        attempt: (event.attempts ?? 0) + 1,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      const attempt = (event.attempts ?? 0) + 1;
      const isDead = attempt >= this.maxAttempts;
      const retryAt = isDead
        ? null
        : new Date(this.now().getTime() + this.backoffMs(attempt));

      const fields = {
        err: error,
        attempt,
        maxAttempts: this.maxAttempts,
        durationMs: Date.now() - startedAt,
        ...(retryAt && { retryAt: retryAt.toISOString() }),
      };
      if (isDead) {
        logger.error("outbox event dead-lettered", fields);
      } else {
        logger.warn("outbox event failed, will retry", fields);
      }

      try {
        await this.outboxRepo.markFailed(event.eventId, error, retryAt);
      } catch (markError) {
        logger.error("failed to record outbox failure", { err: markError });
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
      logger.warn("failed to append redis session cache", { err: error, conversationKey });
    }
  }
}
