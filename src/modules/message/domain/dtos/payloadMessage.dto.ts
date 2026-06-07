import type { StoredFileType } from "../../application/ports/file-storage.port";

export interface PayloadMessage {
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
}
