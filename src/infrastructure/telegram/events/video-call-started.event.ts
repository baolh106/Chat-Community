import type { IBusEvent } from "../../event-bus/domain/bus-event.interface";

export const VIDEO_CALL_STARTED_TOPIC = "video-call.started" as const;

export type VideoCallStartedPayload = {
  callerId: string;
  callType: "audio" | "video";
  adminTelegramId?: string;
  callId: string;
  timestamp?: string;
};

export class VideoCallStartedEvent implements IBusEvent {
  readonly topic = VIDEO_CALL_STARTED_TOPIC;

  constructor(public readonly payload: VideoCallStartedPayload) {}
}