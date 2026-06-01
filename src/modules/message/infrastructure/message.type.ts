export type TMessage = {
  content: string | null;
  imageURL: string | null;
  fileURL: string | null;
  fileDownloadURL: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  fileSize: number | null;
  fileDriveId: string | null;
  attachmentType: "image" | "file" | null;
  createdAt: Date;
  sender: string;
  receiver: string;
  isRead: boolean;
};

export type TErrorNotification = {
  error: unknown;
  component?: string;
  severity?: string;
  context?: string;
};

export type TUserJoinedNotification = {
  userId: string;
  room: string;
  totalUsers: number;
};
