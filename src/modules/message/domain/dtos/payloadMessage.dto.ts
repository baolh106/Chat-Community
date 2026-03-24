export interface PayloadMessage {
  content: string;
  imageURL?: string;
  createdAt: Date;
  sender: string;
  receiver: string;
}
