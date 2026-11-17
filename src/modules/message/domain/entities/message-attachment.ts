export type StoredFileType = "image" | "file";

export type MessageAttachment = {
  fileURL: string;
  fileDownloadURL: string | null;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  fileDriveId: string;
  attachmentType: StoredFileType;
  isUnsafe?: boolean | undefined;
};
