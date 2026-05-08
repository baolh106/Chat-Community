import type { Server } from "socket.io";
import { ADMIN_ROOM, userRoom } from "../domain/room-name";
import type { SocketSessionData } from "../domain/socket-session.types";
import type { ISocketApplication } from "./socket.application.interface";

export class SocketApplication implements ISocketApplication {
  constructor(private readonly io: Server) {}

  emitToUser(userId: string, event: string, data: unknown): void {
    this.io.to(userRoom(userId)).emit(event, data);
  }

  emitToRoom(roomId: string, event: string, data: unknown): void {
    this.io.to(roomId).emit(event, data);
  }

  emitToAdminRoom(event: string, data: unknown): void {
    this.io.to(ADMIN_ROOM).emit(event, data);
  }

  emitToUserRoleInRoom(userId: string, event: string, data: unknown): void {
    void this.emitToUserRoleInRoomAsync(userId, event, data);
  }

  private async emitToUserRoleInRoomAsync(
    userId: string,
    event: string,
    data: unknown,
  ): Promise<void> {
    const room = userRoom(userId);
    const sockets = await this.io.in(room).fetchSockets();
    for (const remote of sockets) {
      const session = remote.data as SocketSessionData;
      if (session?.role === "user" && session?.userId === userId) {
        remote.emit(event, data);
      }
    }
  }
}
