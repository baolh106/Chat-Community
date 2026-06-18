import type { StoredFileType } from "../ports/file-storage.port";

export type MessageCreate = {
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
  isUnsafe?: boolean | undefined;
};
