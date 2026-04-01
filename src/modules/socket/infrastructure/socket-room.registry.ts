import type { Socket } from "socket.io";
import { userRoom } from "../domain/room-name";

/**
 * Trạng thái room in-process: user online theo userId, admin sockets, join/leave đồng bộ.
 */
export class SocketRoomJoinRegistry {
  private readonly connectedUserIds = new Set<string>();
  private readonly userConnectionCount = new Map<string, number>();
  private readonly adminSockets = new Set<Socket>();

  getOnlineUserIds(): string[] {
    return [...this.connectedUserIds];
  }

  addAdmin(socket: Socket): void {
    this.adminSockets.add(socket);
  }

  removeAdmin(socket: Socket): void {
    this.adminSockets.delete(socket);
  }

  /** Mọi admin hiện tại join room `user:${userId}` (user vừa online lần đầu). */
  joinAllAdminsToUserRoom(userId: string): void {
    const room = userRoom(userId);
    for (const adminSocket of this.adminSockets) {
      void adminSocket.join(room);
    }
  }

  /** Admin vừa join: vào tất cả room user đang online. */
  joinAdminToAllUserRooms(adminSocket: Socket): void {
    const rooms = [...this.connectedUserIds].map((uid) => userRoom(uid));
    if (rooms.length > 0) {
      void adminSocket.join(rooms);
    }
  }

  /** User mở thêm tab / kết nối: tăng ref-count; lần đầu thì đánh dấu online + admin join room. */
  registerUserConnected(userId: string): void {
    const next = (this.userConnectionCount.get(userId) ?? 0) + 1;
    this.userConnectionCount.set(userId, next);
    if (next === 1) {
      this.connectedUserIds.add(userId);
      this.joinAllAdminsToUserRoom(userId);
    }
  }

  /** Disconnect user: giảm ref-count; hết kết nối thì gỡ user khỏi set + admin leave room. */
  registerUserDisconnected(userId: string): void {
    const prev = this.userConnectionCount.get(userId) ?? 0;
    if (prev <= 1) {
      this.userConnectionCount.delete(userId);
      this.connectedUserIds.delete(userId);
      const room = userRoom(userId);
      for (const adminSocket of this.adminSockets) {
        void adminSocket.leave(room);
      }
    } else {
      this.userConnectionCount.set(userId, prev - 1);
    }
  }
}
