import type { Server, Socket } from "socket.io";
import { ADMIN_ROOM, userRoom } from "../domain/room-name";
import type { SocketSessionData } from "../domain/socket-session.types";
import { logSocketGateway } from "./socket-gateway.log";
import type { SocketRoomJoinRegistry } from "./socket-room.registry";

export type SocketGatewayAuthOptions = object;

/**
 * Đăng ký connection + admin:join / user:join + log [SocketGateway].
 */
export function registerSocketConnectionGateway(
  io: Server,
  options: SocketGatewayAuthOptions,
  rooms: SocketRoomJoinRegistry,
): void {
  io.on("connection", (socket) => {
    const s = socket as Socket & { data: SocketSessionData };

    logSocketGateway("client connected", { socketId: s.id });

    s.on("disconnect", (reason) => {
      logSocketGateway("socket disconnected", {
        socketId: s.id,
        ...(s.data.userId !== undefined && { userId: s.data.userId }),
        ...(s.data.role !== undefined && { role: s.data.role }),
        reason,
      });
    });

    s.on("admin:join", () => {
      if (s.data.role !== "admin") {
        s.emit("admin:join_denied", { ok: false, reason: "unauthorized" });
        logSocketGateway("admin:join denied", {
          socketId: s.id,
          detail: "not_admin_role",
        });
        return;
      }
      s.data.role = "admin";
      void s.join(ADMIN_ROOM);
      rooms.joinAdminToAllUserRooms(s);
      rooms.addAdmin(s);
      s.emit("admin:joined", {
        ok: true,
        userIds: rooms.getOnlineUserIds(),
      });

      logSocketGateway("admin:join ok", {
        socketId: s.id,
        role: s.data.role || "admin",
        detail: `onlineUsers=${rooms.getOnlineUserIds().length}`,
      });

      s.once("disconnect", () => {
        rooms.removeAdmin(s);
      });
    });

    s.on("user:join", () => {
      if (s.data.role !== "user") {
        s.emit("user:join_denied", {
          ok: false,
          reason: "unauthorized",
        });
        logSocketGateway("user:join denied", {
          socketId: s.id,
          detail: "not_user_role",
        });
        return;
      }
      const userId = s.data.userId;
      if (!userId) {
        s.emit("user:join_denied", {
          ok: false,
          reason: "not found user",
        });
        logSocketGateway("user:join denied", {
          socketId: s.id,
          detail: "not_found_user",
        });
        return;
      }

      void s.join(userRoom(userId));
      rooms.registerUserConnected(userId);

      s.emit("user:joined", {
        ok: true,
        userId,
      });

      logSocketGateway("user:join ok", {
        socketId: s.id,
        userId,
        role: s.data.role || "user",
      });

      s.once("disconnect", () => {
        const uid = s.data.userId;
        if (!uid) return;
        rooms.registerUserDisconnected(uid);
      });
    });
  });
}
