import {
  telegramAppHash,
  telegramAppId,
  telegramHelperSession,
} from "../../../config/env";
import type { ITelegramCallService } from "../application/telegram-call.service.interface";
import { GramJsCallService } from "../infrastructure/gramjs-call.service";
import { TelegramErrorAlerter } from "../infrastructure/telegram-error.alerter";
import { createTelegramNotifier } from "../infrastructure/telegram.notifier";
import { TelegramBotListener } from "../telegram.bot";
import { createLogger } from "../../../shared/logging/logger";

const logger = createLogger("telegram");

function hasCallServiceConfig(): boolean {
  return (
    Number.isInteger(Number(telegramAppId)) &&
    Number(telegramAppId) > 0 &&
    telegramAppHash.length > 0 &&
    telegramHelperSession.length > 0
  );
}

export function telegramModule() {
  const telegramNotifier = createTelegramNotifier();

  const telegramCallService: ITelegramCallService | undefined = hasCallServiceConfig()
    ? new GramJsCallService()
    : undefined;
  if (!telegramCallService) {
    logger.warn("mtproto call service disabled", { reason: "missing app id/hash/session" });
  }

  return {
    telegramNotifier,
    telegramCallService,
    errorAlerter: new TelegramErrorAlerter(telegramNotifier),
    telegramBotListener: new TelegramBotListener(telegramNotifier),
  };
}
