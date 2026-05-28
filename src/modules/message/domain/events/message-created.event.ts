import type { IBusEvent } from "../../../../infrastructure/event-bus/domain/bus-event.interface";
import type { StoredFileType } from "../../application/ports/file-storage.port";

export const MESSAGE_CREATED_TOPIC = "message.created" as const;

export type MessageCreatedPayload = {
  content: string | null;
  imageURL?: string;
  fileURL?: string;
  fileDownloadURL?: string | null;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  fileDriveId?: string;
  attachmentType?: StoredFileType;
  createdAt: Date;
  sender: string;
  receiver: string;
};

export class MessageCreatedEvent implements IBusEvent {
  readonly topic = MESSAGE_CREATED_TOPIC;

  constructor(public readonly payload: MessageCreatedPayload) {}
}
