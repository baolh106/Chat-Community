import type { IMessageRepository } from "../domain/mesage.repository";
import type { IMessageSessionCache } from "../infrastructure/cache/message-session.cache";
import type { ISessionManager } from "./session-manager.interface";
import { MessageSession } from "../constant/constant";
import { redisClient } from "../../../infrastructure/redis";
import { CACHE_PREFIX } from "../../auth/constants/constant";

export class SessionManager implements ISessionManager {
  private disconnectTimer: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private readonly messageSessionCache: IMessageSessionCache,
    private readonly messageRepository: IMessageRepository,
  ) {}

  handleDisconnect(userId: string): void {
    this.cancelPendingTimer(userId);
    const timer = setTimeout(() => {
      void this.finalizeSession(userId).catch((error) => {
        console.error(
          `[SessionManager] Failed to finalize session for user=${userId}`,
          error,
        );
      });
    }, MessageSession.DISCONNECT_TIMEOUT_MS);
    this.disconnectTimer.set(userId, timer);
  }

  handleReconnect(userId: string): void {
    this.cancelPendingTimer(userId);
  }

  async finalizeSession(userId: string): Promise<void> {
    this.cancelPendingTimer(userId);
    const messages = await this.messageSessionCache.getMessages(userId);
    if (messages.length === 0) {
      // Nếu không có tin nhắn nào trong cache, vẫn cần xóa refresh token
      await redisClient.del(`${CACHE_PREFIX.REFRESH_TOKEN}:${userId}`);
      return;
    }

    await this.messageRepository.insertList(messages);
    await this.messageSessionCache.deleteMessages(userId);
    // Xóa refresh token của user khi session bị finalize
    await redisClient.del(`${CACHE_PREFIX.REFRESH_TOKEN}:${userId}`);
  }

  private cancelPendingTimer(userId: string): void {
    const existing = this.disconnectTimer.get(userId);
    if (!existing) {
      return;
    }
    clearTimeout(existing);
    this.disconnectTimer.delete(userId);
  }
}
