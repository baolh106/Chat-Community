import { Telegraf } from "telegraf";
import { telegramBotToken } from "../../config/env";
import type { ITelegramNotifier } from "./application/telegram.notifier.interface";
import { getTemplate } from "./telegram-templates";
import { createLogger } from "../../shared/logging/logger";

const logger = createLogger("telegram-bot");

export class TelegramBotListener {
  private bot: Telegraf;
  private launched = false;

  constructor(private readonly telegramNotifier?: ITelegramNotifier) {
    this.bot = new Telegraf(telegramBotToken);
  }

  stop(reason: string = "shutdown"): void {
    if (!this.launched) return;
    this.launched = false;
    try {
      this.bot.stop(reason);
    } catch (error) {
      logger.error("failed to stop bot", { err: error });
    }
  }

  async start(): Promise<void> {
    if (!this.telegramNotifier) {
      logger.warn("no telegram notifier available, skipping bot listener");
      return;
    }

    if (!telegramBotToken) {
      logger.warn("TELEGRAM_BOT_TOKEN is not configured");
      return;
    }

    // Handle /start command
    this.bot.start((ctx) => {
      const startMessage = `
🤖 <b>Welcome to Chat-Community Bot!</b>

Available commands:
/start - Show this help message
/poll_badminton - Create a badminton poll
/poll_boardgame - Create a board game poll
/help - Show available commands

📝 Usage:
Type <code>/poll_badminton</code> or <code>/poll_boardgame</code> to create a poll with predefined options.
      `;
      ctx.replyWithHTML(startMessage);
    });

    // Handle /help command
    this.bot.help((ctx) => {
      const helpMessage = `
<b>Available Commands:</b>
/poll_badminton - Create a badminton poll
/poll_boardgame - Create a board game poll
/start - Show welcome message

<b>How to use /poll_badminton:</b>
When you send /poll_badminton, a poll will be created with predefined voting options.

<b>How to use /poll_boardgame:</b>
When you send /poll_boardgame, a poll will be created with predefined voting options for board game sessions.
      `;
      ctx.replyWithHTML(helpMessage);
    });

    // Handle /voting command
    this.bot.command("poll_badminton", async (ctx) => {
      try {
        const userId = String(ctx.from?.id ?? "unknown");
        const username = ctx.from?.username || ctx.from?.first_name || "Unknown User";

        logger.info("voting command received", { username, telegramUserId: userId, chatId: ctx.chat.id });

        // Get next month of current month for poll question
        const currentMonth = new Date().getMonth() + 1; // getMonth is 0-indexed
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        // Create a voting poll directly in the chat
        const pollQuestion = `Điểm danh tháng ${nextMonth}?`;
        const pollOptions = [
          "Thứ 3️⃣", 
          "Thứ 5️⃣", 
          "Off ❌"
        ];

        await ctx.replyWithPoll(pollQuestion, pollOptions, {
          is_anonymous: false,
          allows_multiple_answers: true,
        });

        // Send notification to admin about poll creation
        const notifier = this.telegramNotifier;
        if (notifier) {
          const { text, parseMode } = getTemplate("votingPollCreated", {
            username,
            userId,
            question: pollQuestion,
            chatId: ctx.chat.id,
          });

          await notifier.sendMessage(text, { parseMode });
        }
      } catch (error) {
        const username = ctx.from?.username || ctx.from?.first_name || "Unknown User";
        logger.error("failed to create voting poll", { err: error, username });
        await ctx.reply("❌ Failed to create poll. Please try again.");
      }
    });

        // Handle /voting command
    this.bot.command("poll_boardgame", async (ctx) => {
      try {
        const userId = String(ctx.from?.id ?? "unknown");
        const username = ctx.from?.username || ctx.from?.first_name || "Unknown User";

        logger.info("voting command received", { username, telegramUserId: userId, chatId: ctx.chat.id });

        // Create a voting poll directly in the chat
        const pollQuestion = `Điểm danh tuần này nha!`;
        const pollOptions = [
          "Tối Thứ 7 20:00",
          "Chiều Chủ Nhật 15:00",
          "Hẹn lần sau nhé ❌",
        ];

        await ctx.replyWithPoll(pollQuestion, pollOptions, {
          is_anonymous: false,
          allows_multiple_answers: true,
        });

        // Send notification to admin about poll creation
        const notifier = this.telegramNotifier;
        if (notifier) {
          const { text, parseMode } = getTemplate("votingPollCreated", {
            username,
            userId,
            question: pollQuestion,
            chatId: ctx.chat.id,
          });

          await notifier.sendMessage(text, { parseMode });
        }
      } catch (error) {
        const username = ctx.from?.username || ctx.from?.first_name || "Unknown User";
        logger.error("failed to create voting poll", { err: error, username });
        await ctx.reply("❌ Failed to create poll. Please try again.");
      }
    });
    

    this.bot.on("message", async (ctx) => {
      try {
        const notifier = this.telegramNotifier;
        if (!notifier || ctx.chat.type !== "private") {
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

        logger.info("private message received", { username, telegramUserId: userId });
        await notifier.sendMessage(text, { parseMode });
      } catch (error) {
        logger.error("failed to forward bot message to admin", { err: error });
      }
    });

    this.launched = true;
    logger.info("starting long polling");
    try {
      await this.bot.launch();
    } finally {
      this.launched = false;
    }
  }
}
