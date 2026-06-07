import type { IBusEvent } from "../../../../infrastructure/event-bus/domain/bus-event.interface";
import type { StoredFileType } from "../../application/ports/file-storage.port";

export const MESSAGE_CREATED_TOPIC = "message.created" as const;

export type MessageCreatedPayload = {
  content: string | null;
  imageURL?: string | undefined;
  fileURL?: string | undefined;
  fileDownloadURL?: string | null | undefined;
  fileName?: string | undefined;
  fileMimeType?: string | undefined;
  fileSize?: number | undefined;
  fileDriveId?: string | undefined;
  attachmentType?: StoredFileType | undefined;
  createdAt: Date;
  sender: string;
  receiver: string;
  isRead?: boolean | undefined;
};

export class MessageCreatedEvent implements IBusEvent {
  readonly topic = MESSAGE_CREATED_TOPIC;

  constructor(public readonly payload: MessageCreatedPayload) {}
}
