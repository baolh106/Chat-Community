export type TMessage = {
  content: string;
  imageURL: string | null;
  createdAt: Date;
  sender: string;
  receiver: string;
};
