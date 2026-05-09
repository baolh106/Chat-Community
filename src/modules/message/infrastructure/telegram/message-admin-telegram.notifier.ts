import type { ISocketApplication } from "../../../../infrastructure/socket/application/socket.application.interface";
import type { ITelegramNotifier } from "../../../../infrastructure/telegram/application/telegram.notifier.interface";
import { getTemplate } from "../../../../infrastructure/telegram/telegram-templates";
import type { IToolNotifier } from "../../application/ports/tool.port";
import type { MessageCreatedPayload } from "../../domain/events/message-created.event";

/**
 * Nếu không có admin online, gửi thêm cảnh báo đến Telegram.
 */
export class MessageAdminTelegramNotifier implements IToolNotifier {
  constructor(
    private readonly sockets: ISocketApplication,
    private readonly telegramNotifier?: ITelegramNotifier,
  ) {}

  getNameTool(): string {
    return "Telegram";
  }

  async notifyNewMessage(payload: MessageCreatedPayload): Promise<void> {
    const body = {
      ...payload,
      createdAt:
        payload.createdAt instanceof Date
          ? payload.createdAt.toISOString()
          : payload.createdAt,
    };

    const adminOnline = await this.sockets.hasOnlineAdmin();

    if (!adminOnline && this.telegramNotifier) {
      const { text, parseMode } = getTemplate("adminOffline", {
        sender: body.sender,
        receiver: body.receiver,
        content: body.content ?? "<no content>",
        createdAt: body.createdAt,
      });
      await this.telegramNotifier.sendMessage(text, { parseMode });
    }
  }
}
