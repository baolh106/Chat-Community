import type { IBusEvent } from "../domain/bus-event.interface";

/** Port for publishing bus events without exposing subscription wiring. */
export interface IEventBusPublisher {
  publish<T extends IBusEvent>(event: T): Promise<void>;
}
