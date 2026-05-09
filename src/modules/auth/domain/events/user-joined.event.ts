import type { IBusEvent } from "../../../../infrastructure/event-bus/domain/bus-event.interface";

export const USER_JOINED_TOPIC = "user.joined" as const;

export type UserJoinedPayload = {
  userId: string;
  room: string;
  totalUsers: number;
};

export class UserJoinedEvent implements IBusEvent {
  readonly topic = USER_JOINED_TOPIC;

  constructor(public readonly payload: UserJoinedPayload) {}
}
