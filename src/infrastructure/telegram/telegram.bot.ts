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
Type <code>/voting</code> to start creating a poll with predefined options.
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

        console.log(
          `[TelegramBotListener] /voting command from ${username} (${userId}) in chat ${ctx.chat.id}`
        );

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
        console.error(`[TelegramBotListener] Failed to create voting poll by ${username}:`, error);
        await ctx.reply("❌ Failed to create poll. Please try again.");
      }
    });

        // Handle /voting command
    this.bot.command("poll_boardgame", async (ctx) => {
      try {
        const userId = String(ctx.from?.id ?? "unknown");
        const username = ctx.from?.username || ctx.from?.first_name || "Unknown User";

        console.log(
          `[TelegramBotListener] /voting command from ${username} (${userId}) in chat ${ctx.chat.id}`
        );

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
        console.error(`[TelegramBotListener] Failed to create voting poll by ${username}:`, error);
        await ctx.reply("❌ Failed to create poll. Please try again.");
      }
    });
    

    // Handle regular messages
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
        console.error(
          "[TelegramBotListener] Failed to forward bot message to admin:",
          error
        );
      }
    });

    await this.bot.launch();
    console.log("[TelegramBotListener] started listening for bot messages.");
  }
}
