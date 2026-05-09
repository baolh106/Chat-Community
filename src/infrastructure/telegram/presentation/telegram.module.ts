import { createTelegramNotifier } from "../infrastructure/telegram.notifier";
import { TelegramBotListener } from "../telegram.bot";

export function telegramModule() {
  const telegramNotifier = createTelegramNotifier();
  return {
    telegramNotifier,
    telegramBotListener: new TelegramBotListener(telegramNotifier),
  };
}
