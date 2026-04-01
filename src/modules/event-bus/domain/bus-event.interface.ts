/**
 * Marker for payloads published on the in-process event bus (pub/sub by `topic`).
 */
export interface IBusEvent {
  readonly topic: string;
}
