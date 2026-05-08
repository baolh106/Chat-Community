import type { IBusEventHandler } from "../domain/bus-event-handler.interface";
import type { IBusEvent } from "../domain/bus-event.interface";
import type { IEventBus } from "./event-bus.interface";

type HandlerFn = (event: IBusEvent) => Promise<void>;

/**
 * In-memory pub/sub: subscribers register by event `topic`; `publish` dispatches
 * to all handlers for that topic (mediator between publishers and handlers).
 */
export class InMemoryEventBus implements IEventBus {
  private readonly subscribers = new Map<string, HandlerFn[]>();

  register<T extends IBusEvent>(handler: IBusEventHandler<T>): void {
    const key = handler.handles as string;
    const fn: HandlerFn = (e) => handler.handle(e as T);
    const list = this.subscribers.get(key) ?? [];
    list.push(fn);
    this.subscribers.set(key, list);
  }

  async publish<T extends IBusEvent>(event: T): Promise<void> {
    const handlers = this.subscribers.get(event.topic) ?? [];
    await Promise.all(handlers.map((h) => h(event)));
  }
}
