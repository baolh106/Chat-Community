import type { MessageCreate } from "./dtos/param";
import type { UploadFileInput } from "./ports/file-storage.port";

export interface IMessageApplication {
  create(req: MessageCreate): Promise<MessageCreate>;
  createWithFiles(req: MessageCreate, files: UploadFileInput[]): Promise<MessageCreate>;
  insertList(arrReq: MessageCreate[]): Promise<void>;
  getMessages(conversationKey: string): Promise<MessageCreate[]>;
  markMessagesAsRead(conversationKey: string, readerId: string): Promise<number>;
  getUnreadCount(conversationKey: string, readerId: string): Promise<number>;
}
