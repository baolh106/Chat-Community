export interface ISocketService {
  emitToUser(userId: string, event: string, data: unknown): void;
  emitToRoom(roomId: string, event: string, data: unknown): void;
  emitToAdminRoom(event: string, data: unknown): void;
  /**
   * Chỉ socket có role=user và đúng userId trong room `user:${userId}`
   * (tránh admin trong cùng room nhận trùng event).
   */
  emitToUserRoleInRoom(
    userId: string,
    event: string,
    data: unknown,
  ): void;
}
