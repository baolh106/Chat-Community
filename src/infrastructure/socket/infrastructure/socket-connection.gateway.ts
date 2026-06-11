import { randomUUID } from "node:crypto";
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
        files?: Array<{
          data: string;
          name: string;
          mimeType: string;
        }>;
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

        const tempId = randomUUID();
        const message: MessageCreate = {
          sender: senderId as string,
          receiver: payload.receiver,
          content: payload.content || null,
          createdAt: new Date(),
          imageURL: payload.imageURL,
          fileURL: payload.fileURL,
        };

        const targetRoom = payload.receiver === "admin" ? ADMIN_ROOM : userRoom(payload.receiver);
        
        if (!payload.files || payload.files.length === 0) {
          const fastMessage = {
            ...message,
            id: tempId,
            createdAt: message.createdAt.toISOString(),
            status: "sent" // Báo cho client là tin nhắn đã bay đi
          };

          // Phát tin nhắn cho người nhận ngay tại Gateway
          s.to(targetRoom).emit("message:new", fastMessage);

          // Xác nhận cho người gửi
          s.emit("message:send:ack", { ok: true, tempId, message: fastMessage });

          // Xử lý logic nghiệp vụ và bắn Event
          messageCacheApp.create(message).catch(err => {
            console.error("[SocketGateway] Message creation failed:", err);
          });
        } else {
          s.emit("message:uploading", { tempId, count: payload.files.length });
        }

        try {
          if (payload.files && payload.files.length > 0) {
            // Xử lý upload tất cả file song song để tối ưu tốc độ
            const uploadPromises = payload.files.map(async (fileData) => {
              const base64 = fileData.data.includes(",")
                ? fileData.data.split(",").at(-1)
                : fileData.data;
              
              if (!base64) throw new Error(`invalid_file_data: ${fileData.name}`);

              const buffer = Buffer.from(base64, "base64");
              if (buffer.length > uploadMaxFileSizeMb * 1024 * 1024) {
                throw new Error(`file_too_large: ${fileData.name}`);
              }

              return messageCacheApp.createWithFile(
                { ...message }, 
                {
                  buffer,
                  originalName: fileData.name,
                  mimeType: fileData.mimeType,
                  size: buffer.length,
                }
              );
            });

            const uploadedMessages = await Promise.all(uploadPromises);

            const fileMessage = {
              ...message,
              id: tempId,
              content: payload.content || null,
              createdAt: message.createdAt.toISOString(),
              hasAttachments: true,
              attachments: uploadedMessages.map(m => ({
                fileURL: m.fileURL,
                fileDownloadURL: m.fileDownloadURL,
                fileName: m.fileName,
                fileMimeType: m.fileMimeType,
                fileSize: m.fileSize,
                attachmentType: m.attachmentType
              }))
            };

            // Phát tin nhắn chứa file cho người nhận
            s.to(targetRoom).emit("message:new", fileMessage);

            // Xác nhận hoàn tất upload cho người gửi
            s.emit("message:send:ack", { 
              ok: true, 
              tempId, 
              message: fileMessage 
            });
          }
        } catch (error: unknown) {
          if (payload.files) {
            s.emit("message:upload:error", { tempId, reason: "upload_failed" });
          }
          
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
