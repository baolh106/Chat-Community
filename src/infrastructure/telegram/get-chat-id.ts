import { Telegraf } from "telegraf";
import { telegramBotToken } from "../../config/env";

async function main() {
  if (!telegramBotToken) {
    console.error("TELEGRAM_BOT_TOKEN is not set in env");
    process.exit(1);
  }

  const bot = new Telegraf(telegramBotToken);

  console.log(
    "Listening for messages... Send any message to your bot on Telegram to get your chat ID."
  );
  console.log("Press Ctrl+C to exit.\n");

  bot.on("message", (ctx) => {
    const chatId = ctx.chat.id;
    const username = ctx.from?.username || "N/A";
    const firstName = ctx.from?.first_name || "N/A";

    console.log("━".repeat(60));
    console.log(`✅ Chat ID found: ${chatId}`);
    console.log(`Username: @${username}`);
    console.log(`Name: ${firstName}`);
    console.log("━".repeat(60));
    console.log("\nSet this in your .env.development:");
    console.log(`TELEGRAM_CHAT_ID=${chatId}`);
    console.log("\nThen run: npm run test:telegram\n");

    process.exit(0);
  });

  try {
    await bot.launch();
  } catch (error) {
    console.error("Failed to start bot listener:", error);
    process.exit(1);
  }
}

main();
