import type { Server, Socket } from "socket.io";
import { ADMIN_ROOM, userRoom } from "../domain/room-name";
import type { SocketSessionData } from "../domain/socket-session.types";
import { logSocketGateway } from "./socket-gateway.log";
import type { SocketRoomJoinRegistry } from "./socket-room.registry";
import type { ISessionManager } from "../../../modules/message/application/session-manager.interface";
import type { IMessageApplication } from "../../../modules/message/application/message.application.interface";
import type { MessageCreate } from "../../../modules/message/application/dtos/param";

export type SocketGatewayAuthOptions = object;

export type UserJoinedTelegramNotifier = {
  notifyUserJoined?: (
    userId: string,
    room: string,
    totalUsers: number,
  ) => Promise<void>;
};

/**
 * Đăng ký connection + admin:join / user:join + log [SocketGateway].
 */
export function registerSocketConnectionGateway(
  io: Server,
  options: SocketGatewayAuthOptions,
  rooms: SocketRoomJoinRegistry,
  sessionManager?: ISessionManager,
  messageCacheApp?: IMessageApplication,
  telegramNotifier?: UserJoinedTelegramNotifier,
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
      const userCameOnline = rooms.registerUserConnected(userId);
      if (userCameOnline) {
        sessionManager?.handleReconnect(userId);
      }

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
        const wentOfflineAgain = rooms.registerUserDisconnected(uid);
        if (wentOfflineAgain) {
          sessionManager?.handleDisconnect(uid);
        }
      });

      if (userCameOnline && telegramNotifier?.notifyUserJoined) {
        void telegramNotifier.notifyUserJoined(
          userId,
          userRoom(userId),
          rooms.getOnlineUserIds().length,
        );
      }
    });

    s.on(
      "message:send",
      async (payload: {
        content: string;
        imageURL?: string;
        receiver: string;
      }) => {
        const userId = s.data.userId;
        if (!userId || s.data.role !== "user") {
          s.emit("message:error", {
            ok: false,
            reason: "unauthorized",
          });
          return;
        }

        if (!messageCacheApp) {
          s.emit("message:error", {
            ok: false,
            reason: "message service unavailable",
          });
          return;
        }

        if (!payload || typeof payload.receiver !== "string" || typeof payload.content !== "string") {
          s.emit("message:error", {
            ok: false,
            reason: "invalid_payload",
          });
          return;
        }

        const message: MessageCreate = {
          sender: userId,
          receiver: payload.receiver,
          content: payload.content,
          createdAt: new Date(),
          ...(payload.imageURL ? { imageURL: payload.imageURL } : {}),
        };

        try {
          await messageCacheApp.create(message);
          s.emit("message:sent", { ok: true });
        } catch (error: unknown) {
          s.emit("message:error", {
            ok: false,
            reason:
              error instanceof Error
                ? error.message
                : "unknown_error",
          });
        }
      },
    );
  });
}
