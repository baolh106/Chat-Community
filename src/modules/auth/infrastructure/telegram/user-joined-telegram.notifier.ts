import type { ISocketApplication } from "../../../../infrastructure/socket/application/socket.application.interface";
import type { ITelegramNotifier } from "../../../../infrastructure/telegram/application/telegram.notifier.interface";
import { getTemplate } from "../../../../infrastructure/telegram/telegram-templates";
import type { IToolNotifier } from "../../application/ports/tool.port";
import type { UserJoinedPayload } from "../../domain/events/user-joined.event";

/**
 * Send notification when a new user joins.
 */
export class UserJoinedTelegramNotifier implements IToolNotifier {
  constructor(
    private readonly telegramNotifier?: ITelegramNotifier,
  ) {}

  getNameTool(): string {
    return "Telegram";
  }

  async notifyUserJoined(payload: UserJoinedPayload): Promise<void> {
    if (!this.telegramNotifier) {
      return;
    }

    const { text, parseMode } = getTemplate("userJoined", {
      username: payload.userId,
      room: payload.room,
      totalUsers: payload.totalUsers,
    });

    await this.telegramNotifier.sendMessage(text, { parseMode });
  }
}
