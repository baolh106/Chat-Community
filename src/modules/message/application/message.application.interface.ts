import type { MessageCreate } from "./dtos/param";
import type { UploadFileInput } from "./ports/file-storage.port";

export interface IMessageApplication {
  create(req: MessageCreate): Promise<void>;
  createWithFile(req: MessageCreate, file: UploadFileInput): Promise<MessageCreate>;
  insertList(arrReq: MessageCreate[]): Promise<void>;
  getMessagesByUserId(userId: string): Promise<MessageCreate[]>;
  markMessagesAsRead(userId: string, readerId: string): Promise<number>;
  getUnreadCount(userId: string, readerId: string): Promise<number>;
}
