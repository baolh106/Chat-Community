import type {
  MessageAttachment,
  StoredFileType,
} from "../entities/message-attachment";

export interface PayloadMessage {
  id?: string | undefined;
  content: string | null;
  attachments?: MessageAttachment[] | undefined;
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
  isUnsafe?: boolean | undefined;
}
