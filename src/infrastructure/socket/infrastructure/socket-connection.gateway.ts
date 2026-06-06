import type { Server, Socket } from "socket.io";
import { ADMIN_ROOM, userRoom } from "../domain/room-name";
import type { SocketSessionData } from "../domain/socket-session.types";
import { logSocketGateway } from "./socket-gateway.log";
import type { SocketRoomJoinRegistry } from "./socket-room.registry";
import type { ISessionManager } from "../../../modules/message/application/session-manager.interface";
import type { IMessageApplication } from "../../../modules/message/application/message.application.interface";
import type { MessageCreate } from "../../../modules/message/application/dtos/param";
import type { IEventBusPublisher } from "../../event-bus/application/event-bus-publisher.interface";
import { UserJoinedEvent } from "../../../modules/auth/domain/events/user-joined.event";
import { uploadMaxFileSizeMb } from "../../../config/env";

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
  rooms: SocketRoomJoinRegistry,
  sessionManager?: ISessionManager,
  messageCacheApp?: IMessageApplication,
  eventBus?: IEventBusPublisher,
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

    s.on("admin:join", async () => {
      if (s.data.role !== "admin") {
        s.emit("admin:join_denied", { ok: false, reason: "unauthorized" });
        logSocketGateway("admin:join denied", {
          socketId: s.id,
          detail: "not_admin_role",
        });
        return;
      }

      const onlineUserIds = rooms.getOnlineUserIds();
      const history: Record<string, MessageCreate[]> = {};

      // Lấy tin nhắn cũ từ cache cho tất cả user đang online
      if (messageCacheApp) {
        await Promise.all(
          onlineUserIds.map(async (uid) => {
            history[uid] = await messageCacheApp.getMessagesByUserId(uid);
          }),
        );
      }

      s.data.role = "admin";
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
      const isReconnecting = sessionManager?.isPendingDisconnect(userId) ?? false;

      if (userCameOnline) {
        sessionManager?.handleReconnect(userId);
      }

      // Chỉ thông báo online nếu không phải là reconnect (F5)
      if (userCameOnline && !isReconnecting) {
        io.to(ADMIN_ROOM).emit("user:online", {
          userId,
          totalOnline: rooms.getOnlineUserIds().length,
          timestamp: new Date().toISOString()
        });
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
      console.log(
        `usercameonline=${userCameOnline} totalOnline=${rooms.getOnlineUserIds().length} and eventBus=${!!eventBus}`,
      );
      if (userCameOnline && !isReconnecting && eventBus) {
        console.log(
          `[socket-gateway] publish event ${UserJoinedEvent.name} for user: ${rooms.getOnlineUserIds().length} online`,
        );
        void eventBus.publish(
          new UserJoinedEvent({
            userId,
            totalUsers: rooms.getOnlineUserIds().length,
          }),
        );
      }
    });

    s.on(
      "message:send",
      async (payload: {
        content?: string | null;
        imageURL?: string;
        fileURL?: string;
        file?: {
          data: string;
          name: string;
          mimeType: string;
        };
        receiver: string;
      }) => {
        const { role, userId } = s.data;
        const senderId = role === "admin" ? "admin" : userId;

        if (!role || (role === "user" && !userId)) {
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

        if (!payload || typeof payload.receiver !== "string") {
          s.emit("message:error", {
            ok: false,
            reason: "invalid_payload",
          });
          return;
        }

        const message: MessageCreate = {
          sender: senderId as string,
          receiver: payload.receiver,
          content:
            typeof payload.content === "string" && payload.content.length > 0
              ? payload.content
              : null,
          createdAt: new Date(),
          ...(payload.imageURL ? { imageURL: payload.imageURL } : {}),
          ...(payload.fileURL ? { fileURL: payload.fileURL } : {}),
        };

        try {
          if (payload.file) {
            if (
              typeof payload.file.data !== "string" ||
              typeof payload.file.name !== "string" ||
              typeof payload.file.mimeType !== "string"
            ) {
              s.emit("message:error", {
                ok: false,
                reason: "invalid_file_payload",
              });
              return;
            }

            const base64 = payload.file.data.includes(",")
              ? payload.file.data.split(",").at(-1)
              : payload.file.data;
            
            if (!base64) {
              s.emit("message:error", { ok: false, reason: "invalid_file_data" });
              return;
            }

            const buffer = Buffer.from(base64, "base64");
            
            if (buffer.length > uploadMaxFileSizeMb * 1024 * 1024) {
              s.emit("message:error", {
                ok: false,
                reason: "file_too_large",
              });
              return;
            }

            await messageCacheApp.createWithFile(message, {
              buffer,
              originalName: payload.file.name,
              mimeType: payload.file.mimeType,
              size: buffer.length,
            });
          } else {
            await messageCacheApp.create(message);
          }
        } catch (error: unknown) {
          console.error("[SocketGateway] message:send error:", error);
          
          // Trích xuất lỗi chi tiết hơn nếu có (ví dụ từ Google Drive API/Axios)
          const errorMessage = (error as any)?.response?.data?.error?.message 
            || (error as any)?.message 
            || "unknown_error";

          s.emit("message:error", {
            ok: false,
            reason: errorMessage,
          });
        }
      },
    );
  });
}
