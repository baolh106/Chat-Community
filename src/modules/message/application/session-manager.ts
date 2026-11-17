import { MessageSession } from "../constant/constant";
import type { IMessageSessionCache } from "./ports/message-session-cache.port";
import type { ISessionRevoker } from "./ports/session-revoker.port";
import type { ISessionManager } from "./session-manager.interface";

export class SessionManager implements ISessionManager {
  private readonly disconnectTimer = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly _messageSessionCache: IMessageSessionCache,
    private readonly _sessionRevoker?: ISessionRevoker,
    private readonly _disconnectTimeoutMs: number = MessageSession.DISCONNECT_TIMEOUT_MS,
  ) {}

  isPendingDisconnect(userId: string): boolean {
    return this.disconnectTimer.has(userId);
  }

  handleDisconnect(userId: string): void {
    this.cancelPendingTimer(userId);
    const timer = setTimeout(() => {
      void this.finalizeSession(userId);
    }, this._disconnectTimeoutMs);
    timer.unref?.();
    this.disconnectTimer.set(userId, timer);
  }

  handleReconnect(userId: string): void {
    this.cancelPendingTimer(userId);
  }

  async finalizeSession(userId: string): Promise<void> {
    this.cancelPendingTimer(userId);
    const results = await Promise.allSettled([
      this._messageSessionCache.deleteMessages(userId),
      this._sessionRevoker?.revoke(userId) ?? Promise.resolve(),
    ]);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          `[SessionManager] Failed to cleanup session for user=${userId}`,
          result.reason,
        );
      }
    }
  }

  dispose(): void {
    for (const timer of this.disconnectTimer.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimer.clear();
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
