export interface Message {
  id: string;
  createdAt: Date;
  content: string | null;
  imageURL: string | null;
  fileURL: string | null;
  fileDownloadURL: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  fileSize: number | null;
  fileDriveId: string | null;
  attachmentType: "image" | "file" | null;
  sender: string;
  receiver: string;
  isRead: boolean;
}
