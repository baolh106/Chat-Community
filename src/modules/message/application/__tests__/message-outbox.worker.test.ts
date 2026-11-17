import type { IEventBusPublisher } from "../../../../infrastructure/event-bus/application/event-bus-publisher.interface";
import { MessageCreatedEvent } from "../../domain/events/message-created.event";
import type {
  IMessageOutboxRepository,
  MessageOutboxRecord,
} from "../../domain/message-outbox.repository";
import { MessageOutboxWorker } from "../message-outbox.worker";
import type { IMessageSessionCache } from "../ports/message-session-cache.port";

const NOW = new Date("2026-11-17T00:00:00.000Z");

function record(overrides: Partial<MessageOutboxRecord> = {}): MessageOutboxRecord {
  return {
    eventId: "evt-1",
    type: "message.created",
    payload: {
      id: "msg-1",
      sender: "bob_1",
      receiver: "admin",
      content: "hi",
      createdAt: NOW,
    },
    status: "processing",
    attempts: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function setup(events: MessageOutboxRecord[], opts = {}) {
  const repo: jest.Mocked<IMessageOutboxRepository> = {
    ensureReady: jest.fn(async () => undefined),
    createMessageCreated: jest.fn(async () => undefined),
    claimPending: jest.fn(async () => events),
    markProcessed: jest.fn(async () => undefined),
    markFailed: jest.fn(async () => undefined),
  };
  const bus: jest.Mocked<IEventBusPublisher> = { publish: jest.fn(async () => undefined) };
  const cache: jest.Mocked<IMessageSessionCache> = {
    appendMessages: jest.fn(async () => 1),
    getMessages: jest.fn(async () => []),
    markMessagesAsRead: jest.fn(async () => 0),
    getUnreadCount: jest.fn(async () => 0),
    deleteMessages: jest.fn(async () => undefined),
  };
  const worker = new MessageOutboxWorker(repo, bus, cache, {
    maxAttempts: 3,
    baseBackoffMs: 1000,
    maxBackoffMs: 10_000,
    lockMs: 30_000,
    now: () => NOW,
    ...opts,
  });
  return { worker, repo, bus, cache };
}

describe("MessageOutboxWorker", () => {
  it("should publish, append cache and mark processed when an event succeeds", async () => {
    const { worker, repo, bus, cache } = setup([record()]);

    await worker.processPending();

    expect(repo.claimPending).toHaveBeenCalledWith(25, 30_000);
    expect(bus.publish).toHaveBeenCalledWith(expect.any(MessageCreatedEvent));
    expect(cache.appendMessages).toHaveBeenCalledWith("bob_1", [
      expect.objectContaining({ id: "msg-1" }),
    ]);
    expect(repo.markProcessed).toHaveBeenCalledWith("evt-1");
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it("should schedule a retry with backoff when publish fails", async () => {
    const { worker, repo, bus } = setup([record({ attempts: 1 })]);
    bus.publish.mockRejectedValueOnce(new Error("telegram down"));

    await worker.processPending();

    expect(repo.markFailed).toHaveBeenCalledWith(
      "evt-1",
      expect.any(Error),
      new Date(NOW.getTime() + 2000),
    );
    expect(repo.markProcessed).not.toHaveBeenCalled();
  });

  it("should dead-letter the event when max attempts is reached", async () => {
    const { worker, repo, bus } = setup([record({ attempts: 2 })]);
    bus.publish.mockRejectedValueOnce(new Error("still down"));

    await worker.processPending();

    expect(repo.markFailed).toHaveBeenCalledWith("evt-1", expect.any(Error), null);
  });

  it("should still mark processed when the cache append fails", async () => {
    const { worker, repo, cache } = setup([record()]);
    cache.appendMessages.mockRejectedValueOnce(new Error("redis down"));

    await worker.processPending();

    expect(repo.markProcessed).toHaveBeenCalledWith("evt-1");
  });

  it("should use eventId as cache dedupe key when a legacy payload has no id", async () => {
    const legacy = record();
    delete legacy.payload.id;
    const { worker, cache } = setup([legacy]);

    await worker.processPending();

    expect(cache.appendMessages).toHaveBeenCalledWith("bob_1", [
      expect.objectContaining({ id: "evt-1" }),
    ]);
  });

  it("should continue with the next event when one event fails", async () => {
    const { worker, repo, bus } = setup([record(), record({ eventId: "evt-2" })]);
    bus.publish.mockRejectedValueOnce(new Error("boom"));

    await worker.processPending();

    expect(repo.markFailed).toHaveBeenCalledWith("evt-1", expect.any(Error), expect.any(Date));
    expect(repo.markProcessed).toHaveBeenCalledWith("evt-2");
  });

  it("should not run two batches concurrently when called twice", async () => {
    const { worker, repo } = setup([record()]);

    await Promise.all([worker.processPending(), worker.processPending()]);

    expect(repo.claimPending).toHaveBeenCalledTimes(1);
  });

  it("should not throw when claiming fails", async () => {
    const { worker, repo } = setup([]);
    repo.claimPending.mockRejectedValueOnce(new Error("mongo down"));

    await expect(worker.processPending()).resolves.toBeUndefined();
  });

  it("should cap backoff at maxBackoffMs", () => {
    const { worker } = setup([]);
    expect(worker.backoffMs(1)).toBe(1000);
    expect(worker.backoffMs(3)).toBe(4000);
    expect(worker.backoffMs(20)).toBe(10_000);
  });
});
