import { InMemoryEventBus } from "../application/event-bus.mediator";

export const eventBusModule = () => {
  const eventBus = new InMemoryEventBus();
  return { eventBus };
};
