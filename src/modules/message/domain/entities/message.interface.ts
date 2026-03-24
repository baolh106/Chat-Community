export interface Message {
  id: string;
  createdAt: Date;
  content: string;
  imageURL: string | null;
  sender: string;
  receiver: string;
}
