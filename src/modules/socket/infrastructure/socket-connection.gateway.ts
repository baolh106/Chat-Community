import type { Server } from "socket.io";
import type { Socket } from "socket.io";
import { ADMIN_ROOM, userRoom } from "../domain/room-name";
import type { SocketSessionData } from "../domain/socket-session.types";
import { logSocketGateway } from "./socket-gateway.log";
import type { SocketRoomJoinRegistry } from "./socket-room.registry";

export type SocketGatewayAuthOptions = {
  adminJoinSecret: string;
  userJoinSecret: string;
};

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

    s.on("admin:join", (token: unknown) => {
      const secret = options.adminJoinSecret;
      if (!secret || token !== secret) {
        s.emit("admin:join_denied", { ok: false });
        logSocketGateway("admin:join denied", {
          socketId: s.id,
          detail: "invalid_or_missing_secret",
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
        role: "admin",
        detail: `onlineUsers=${rooms.getOnlineUserIds().length}`,
      });

      s.once("disconnect", () => {
        rooms.removeAdmin(s);
      });
    });

    s.on("user:join", (payload: unknown) => {
      if (!options.userJoinSecret) {
        s.emit("user:join_denied", {
          ok: false,
          reason: "USER_SOCKET_SECRET not configured",
        });
        logSocketGateway("user:join denied", {
          socketId: s.id,
          detail: "USER_SOCKET_SECRET not configured",
        });
        return;
      }
      if (
        !payload ||
        typeof payload !== "object" ||
        !("userId" in payload) ||
        !("token" in payload)
      ) {
        s.emit("user:join_denied", { ok: false, reason: "invalid_payload" });
        logSocketGateway("user:join denied", {
          socketId: s.id,
          detail: "invalid_payload",
        });
        return;
      }
      const { userId, token } = payload as {
        userId: unknown;
        token: unknown;
      };
      if (
        typeof userId !== "string" ||
        userId.length === 0 ||
        token !== options.userJoinSecret
      ) {
        s.emit("user:join_denied", { ok: false, reason: "invalid_token" });
        logSocketGateway("user:join denied", {
          socketId: s.id,
          detail: "invalid_token",
        });
        return;
      }

      s.data.role = "user";
      s.data.userId = userId;
      void s.join(userRoom(userId));
      rooms.registerUserConnected(userId);

      s.emit("user:joined", { ok: true, userId });

      logSocketGateway("user:join ok", {
        socketId: s.id,
        userId,
        role: "user",
      });

      s.once("disconnect", () => {
        const uid = s.data.userId;
        if (!uid) return;
        rooms.registerUserDisconnected(uid);
      });
    });
  });
}
