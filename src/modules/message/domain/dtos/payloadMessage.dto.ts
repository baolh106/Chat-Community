import type { StoredFileType } from "../../application/ports/file-storage.port";

export interface PayloadMessage {
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
  isRead?: boolean;
}
