import { Telegraf } from "telegraf";
import { telegramBotToken, telegramChatId } from "../../../config/env";
import type { ITelegramNotifier } from "../application/telegram.notifier.interface";

export class NoopTelegramNotifier implements ITelegramNotifier {
  async sendMessage(): Promise<void> {
    return;
  }
}

export class TelegramNotifier implements ITelegramNotifier {
  private readonly bot: Telegraf;
  private readonly chatId: string;

  constructor(token: string, chatId: string) {
    this.bot = new Telegraf(token);
    this.chatId = chatId;
  }

  async sendMessage(
    text: string,
    options?: { parseMode?: "HTML" | "MarkdownV2" },
  ): Promise<void> {
    if (!this.chatId || !this.bot) {
      return;
    }
    try {
      const sendOptions = options?.parseMode
        ? { parse_mode: options.parseMode }
        : undefined;
      await this.bot.telegram.sendMessage(this.chatId, text, sendOptions);
    } catch (error) {
      console.error("[TelegramNotifier] Failed to send message", error);
    }
  }
}

export function createTelegramNotifier(): ITelegramNotifier {
  if (!telegramBotToken || !telegramChatId) {
    return new NoopTelegramNotifier();
  }

  return new TelegramNotifier(telegramBotToken, telegramChatId);
}
