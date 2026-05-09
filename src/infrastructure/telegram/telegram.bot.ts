import { Telegraf } from "telegraf";
import { telegramBotToken } from "../../config/env";
import type { ITelegramNotifier } from "./application/telegram.notifier.interface";
import { getTemplate } from "./telegram-templates";

export class TelegramBotListener {
  private bot: Telegraf;

  constructor(private readonly telegramNotifier?: ITelegramNotifier) {
    this.bot = new Telegraf(telegramBotToken);
  }

  async start(): Promise<void> {
    if (!this.telegramNotifier) {
      console.warn("[TelegramBotListener] No telegram notifier available, skipping bot listener.");
      return;
    }

    if (!telegramBotToken) {
      console.warn("[TelegramBotListener] TELEGRAM_BOT_TOKEN is not configured.");
      return;
    }

    this.bot.on("message", async (ctx) => {
      try {
        const notifier = this.telegramNotifier;
        if (!notifier) {
          return;
        }

        const userId = String(ctx.from?.id ?? "unknown");
        const username = ctx.from?.username || ctx.from?.first_name || "Unknown User";
        const messageText =
          typeof ctx.message === "string"
            ? ctx.message
            : (ctx.message as any)?.text || "<no text>";

        const { text, parseMode } = getTemplate("userBotMessageInfo", {
          username,
          userId,
          message: String(messageText),
        });

        console.log(`[TelegramBotListener] Received message from bot user ${username} (${userId}): ${messageText}`);
        await notifier.sendMessage(text, { parseMode });
      } catch (error) {
        console.error("[TelegramBotListener] Failed to forward bot message to admin:", error);
      }
    });

    await this.bot.launch();
    console.log("[TelegramBotListener] started listening for bot messages.");
  }
}
