export type TMessage = {
  content: string;
  imageURL: string | null;
  createdAt: Date;
  sender: string;
  receiver: string;
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
