export type MessageCreate = {
  content: string;
  imageURL?: string;
  createdAt: Date;
  sender: string;
  receiver: string;
};
