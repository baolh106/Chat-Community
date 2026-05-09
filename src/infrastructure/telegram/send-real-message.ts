import { createTelegramNotifier, NoopTelegramNotifier } from "./infrastructure/telegram.notifier";
import { getTemplate, listTemplates } from "./telegram-templates";

async function main() {
  const notifier = createTelegramNotifier();

  if (notifier instanceof NoopTelegramNotifier) {
    console.error(
      "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing. Set env vars or use .env.development before running this script."
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const templateName = args[0] || "simple";

  // Show help if requested
  if (templateName === "--help" || templateName === "-h" || templateName === "list") {
    listTemplates();
    process.exit(0);
  }

  try {
    const templateNameNormalized = templateName as string;
    let template = getTemplate(templateNameNormalized);

    if (templateNameNormalized === "adminOffline") {
      template = getTemplate("adminOffline", {
        sender: "John Doe",
        receiver: "support",
        content: "Hello admin! I need help",
        createdAt: new Date().toISOString(),
      });
    } else if (templateNameNormalized === "userJoined") {
      template = getTemplate("userJoined", {
        username: "Alice",
        room: "General Chat",
        totalUsers: 15,
      });
    } else if (templateNameNormalized === "errorNotification") {
      template = getTemplate("errorNotification", {
        error: "Database disconnected",
        component: "Message Service",
        severity: "High",
        context: "createMessage",
      });
    } else if (templateNameNormalized === "userBotMessageInfo") {
      template = getTemplate("userBotMessageInfo", {
        username: "alice123",
        userId: "123456789",
        message: "Hi bot!",
      });
    }

    await notifier.sendMessage(template.text, { parseMode: template.parseMode });
    console.log("✅ Telegram test message sent successfully.\n");
    console.log("📧 Message preview:\n");
    console.log(template.text);
  } catch (error) {
    console.error("Failed to send Telegram test message:", error);
    process.exit(1);
  }
}

main();
