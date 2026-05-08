import type { MessageCreatedPayload } from "../../domain/events/message-created.event";
import type { ISocketApplication } from "../../../socket/application/socket.application.interface";
import type { IRealtimeNotifier } from "../../application/ports/realtime.port";

const MESSAGE_NEW = "message:new";

/**
 * Đẩy realtime tin nhắn mới qua Socket.IO (dùng ISocketService của module socket).
 */
export class MessageUserSocketNotifier implements IRealtimeNotifier {
  constructor(private readonly sockets: ISocketApplication) {}

  notifyNewMessage(payload: MessageCreatedPayload): void {
    const body = {
      ...payload,
      createdAt:
        payload.createdAt instanceof Date
          ? payload.createdAt.toISOString()
          : payload.createdAt,
    };
    this.sockets.emitToUser(payload.receiver, MESSAGE_NEW, body);
  }
}
