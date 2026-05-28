export type StoredFileType = "image" | "file";

export type UploadFileInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
};

export type StoredFile = {
  driveId: string;
  url: string;
  downloadUrl: string | null;
  name: string;
  mimeType: string;
  size: number;
  type: StoredFileType;
};

export interface IFileStorage {
  upload(file: UploadFileInput): Promise<StoredFile>;
}
