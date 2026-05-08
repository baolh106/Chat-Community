export interface ISessionManager {
  handleDisconnect(userId: string): void;
  handleReconnect(userId: string): void;
  finalizeSession(userId: string): Promise<void>;
}