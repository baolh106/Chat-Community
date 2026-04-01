import type { IBusEventHandler } from "../domain/bus-event-handler.interface";
import type { IBusEvent } from "../domain/bus-event.interface";
import type { IEventBusPublisher } from "./event-bus-publisher.interface";

export interface IEventBus extends IEventBusPublisher {
  register<T extends IBusEvent>(handler: IBusEventHandler<T>): void;
}
