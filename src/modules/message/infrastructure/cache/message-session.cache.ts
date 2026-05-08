import { redisClient } from "../../../../infrastructure/redis";
import type { MessageCreate } from "../../application/dtos/param";
import { MessageSession } from "../../constant/constant";

export interface IMessageSessionCache {
  appendMessage(userId: string, message: MessageCreate): Promise<void>;
  appendMessages(userId: string, messages: MessageCreate[]): Promise<void>;
  getMessages(userId: string): Promise<MessageCreate[]>;
  deleteMessages(userId: string): Promise<void>;
  hasMessages(userId: string): Promise<boolean>;
}

export class MessageSessionCache implements IMessageSessionCache {
  private getRedisKey(userId: string): string {
    return `${MessageSession.CACHE_KEY_PREFIX}:${userId}`;
  }

  async appendMessage(userId: string, message: MessageCreate): Promise<void> {
    await this.appendMessages(userId, [message]);
  }

  async appendMessages(userId: string, messages: MessageCreate[]): Promise<void> {
    const key = this.getRedisKey(userId);
    const current = await this.getMessages(userId);
    const next = [...current, ...messages].map((message) => ({
      ...message,
      createdAt:
        message.createdAt instanceof Date
          ? message.createdAt.toISOString()
          : message.createdAt,
    }));
    await redisClient.setJson(key, next, MessageSession.CACHE_TTL);
  }

  async getMessages(userId: string): Promise<MessageCreate[]> {
    const key = this.getRedisKey(userId);
    const existing = await redisClient.getJson<MessageCreate[]>(key);
    if (!existing || !Array.isArray(existing)) {
      return [];
    }

    return existing.map((message) => ({
      ...message,
      createdAt:
        message.createdAt instanceof Date
          ? message.createdAt
          : new Date(message.createdAt),
    }));
  }

  async deleteMessages(userId: string): Promise<void> {
    const key = this.getRedisKey(userId);
    await redisClient.del(key);
  }

  async hasMessages(userId: string): Promise<boolean> {
    const key = this.getRedisKey(userId);
    return await redisClient.exists(key);
  }
}
