import type { MessageCreate } from "../dtos/param";

export interface IMessageSessionCache {
  appendMessages(conversationKey: string, messages: MessageCreate[]): Promise<number>;
  getMessages(conversationKey: string): Promise<MessageCreate[]>;
  markMessagesAsRead(conversationKey: string, readerId: string): Promise<number>;
  getUnreadCount(conversationKey: string, readerId: string): Promise<number>;
  deleteMessages(conversationKey: string): Promise<void>;
}
