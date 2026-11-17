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
    if (!this.telegramNotifier) {
      return;
    }

    const adminOnline = await this.sockets.hasOnlineAdmin();
    if (adminOnline) {
      return;
    }

    const attachments = payload.attachments ?? [];
    const first = attachments[0];
    const createdAt =
      payload.createdAt instanceof Date
        ? payload.createdAt.toISOString()
        : String(payload.createdAt);

    const { text, parseMode } = getTemplate("adminOffline", {
      sender: payload.sender,
      receiver: payload.receiver,
      content: payload.content ?? "<no content>",
      createdAt,
      attachmentType: first?.attachmentType ?? payload.attachmentType,
      fileName:
        attachments.length > 1
          ? `${first?.fileName} (+${attachments.length - 1} file)`
          : (first?.fileName ?? payload.fileName),
      fileURL: first?.fileURL ?? payload.fileURL,
    });
    await this.telegramNotifier.sendMessage(text, { parseMode });
  }
}
