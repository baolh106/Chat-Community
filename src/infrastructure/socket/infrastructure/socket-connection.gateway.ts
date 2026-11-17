import type { Server, Socket } from "socket.io";
import { UserJoinedEvent } from "../../../modules/auth/domain/events/user-joined.event";
import type { MessageCreate } from "../../../modules/message/application/dtos/param";
import type { IMessageApplication } from "../../../modules/message/application/message.application.interface";
import type { ISessionManager } from "../../../modules/message/application/session-manager.interface";
import type { IEventBusPublisher } from "../../event-bus/application/event-bus-publisher.interface";
import { ADMIN_ROOM, userRoom } from "../domain/room-name";
import type { SocketSessionData } from "../domain/socket-session.types";
import { logSocketGateway } from "./socket-gateway.log";
import type { MessageSendHandler } from "./socket-message.handler";
import type { SocketRoomJoinRegistry } from "./socket-room.registry";

export type SocketConnectionGatewayDeps = {
  sessionManager: ISessionManager;
  messageApp: IMessageApplication;
  eventBus: IEventBusPublisher;
  onMessageSend: MessageSendHandler;
};

/**
 * Đăng ký connection + admin:join / user:join + log [SocketGateway].
 */
export function registerSocketConnectionGateway(
  io: Server,
  rooms: SocketRoomJoinRegistry,
  deps: SocketConnectionGatewayDeps,
): void {
  const { sessionManager, messageApp, eventBus, onMessageSend } = deps;

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

    s.on("admin:join", async () => {
      if (s.data.role !== "admin") {
        s.emit("admin:join_denied", { ok: false, reason: "unauthorized" });
        logSocketGateway("admin:join denied", {
          socketId: s.id,
          detail: "not_admin_role",
        });
        return;
      }
      if (s.data.joined) {
        return;
      }
      s.data.joined = true;

      const onlineUserIds = rooms.getOnlineUserIds();
      const history: Record<string, MessageCreate[]> = {};

      await Promise.all(
        onlineUserIds.map(async (uid) => {
          try {
            history[uid] = await messageApp.getMessages(uid);
          } catch (error) {
            console.error(`[SocketGateway] Failed to load history for user=${uid}`, error);
            history[uid] = [];
          }
        }),
      );

      void s.join(ADMIN_ROOM);
      rooms.joinAdminToAllUserRooms(s);
      rooms.addAdmin(s);
      s.emit("admin:joined", {
        ok: true,
        userIds: onlineUserIds,
        history,
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

    s.on("user:join", () => {
      if (s.data.role !== "user") {
        s.emit("user:join_denied", { ok: false, reason: "unauthorized" });
        logSocketGateway("user:join denied", {
          socketId: s.id,
          detail: "not_user_role",
        });
        return;
      }

      const userId = s.data.userId;
      if (!userId) {
        s.emit("user:join_denied", { ok: false, reason: "not found user" });
        logSocketGateway("user:join denied", {
          socketId: s.id,
          detail: "not_found_user",
        });
        return;
      }

      if (s.data.joined) {
        s.emit("user:joined", { ok: true, userId });
        return;
      }
      s.data.joined = true;

      void s.join(userRoom(userId));
      const userCameOnline = rooms.registerUserConnected(userId);
      const isReconnecting = sessionManager.isPendingDisconnect(userId);

      if (userCameOnline) {
        sessionManager.handleReconnect(userId);
      }

      // Chỉ thông báo online nếu không phải là reconnect (F5)
      if (userCameOnline && !isReconnecting) {
        const totalOnline = rooms.getOnlineUserIds().length;
        io.to(ADMIN_ROOM).emit("user:online", {
          userId,
          totalOnline,
          timestamp: new Date().toISOString(),
        });
        void eventBus
          .publish(new UserJoinedEvent({ userId, totalUsers: totalOnline }))
          .catch((error) => {
            console.error("[SocketGateway] Failed to publish UserJoinedEvent", error);
          });
      }

      s.emit("user:joined", { ok: true, userId });

      logSocketGateway("user:join ok", {
        socketId: s.id,
        userId,
        role: "user",
      });

      s.once("disconnect", () => {
        const wentOffline = rooms.registerUserDisconnected(userId);
        if (wentOffline) {
          sessionManager.handleDisconnect(userId);
        }
      });
    });

    s.on("message:send", (payload: unknown) => {
      void onMessageSend(s, payload).catch((error) => {
        console.error("[SocketGateway] Unhandled message:send error", error);
      });
    });
  });
}
