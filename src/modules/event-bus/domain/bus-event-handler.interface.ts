import type { IBusEvent } from "./bus-event.interface";

export interface IBusEventHandler<T extends IBusEvent> {
  readonly handles: T["topic"];
  handle(event: T): Promise<void>;
}
