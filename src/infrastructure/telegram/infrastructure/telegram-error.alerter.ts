import type {
  ErrorAlert,
  IErrorAlerter,
} from "../../../shared/alerting/error-alerter.interface";
import { withRetry } from "../../../shared/utils/retry";
import type { ITelegramNotifier } from "../application/telegram.notifier.interface";
import { getTemplate } from "../telegram-templates";
import { createLogger } from "../../../shared/logging/logger";

const logger = createLogger("telegram");

const DEFAULT_THROTTLE_MS = 60_000;
const MAX_TRACKED_KEYS = 500;

export class TelegramErrorAlerter implements IErrorAlerter {
  private readonly lastSentAt = new Map<string, number>();

  constructor(
    private readonly _notifier: ITelegramNotifier,
    private readonly _throttleMs: number = DEFAULT_THROTTLE_MS,
    private readonly _now: () => number = Date.now,
  ) {}

  alert(alert: ErrorAlert): void {
    const key = `${alert.context}|${alert.message}`;
    const now = this._now();
    const last = this.lastSentAt.get(key);
    if (last !== undefined && now - last < this._throttleMs) {
      return;
    }
    this.remember(key, now);

    const { text, parseMode } = getTemplate("errorNotification", {
      error: alert.message,
      component: alert.component,
      severity: alert.statusCode >= 500 ? "Critical" : "High",
      context: alert.context,
    });

    void withRetry(() => this._notifier.sendMessage(text, { parseMode }), 2, 500)
      .catch((error) => {
        logger.error("failed to send error alert", { err: error });
      });
  }

  private remember(key: string, now: number): void {
    if (this.lastSentAt.size >= MAX_TRACKED_KEYS) {
      for (const [k, sentAt] of this.lastSentAt) {
        if (now - sentAt >= this._throttleMs) this.lastSentAt.delete(k);
      }
      if (this.lastSentAt.size >= MAX_TRACKED_KEYS) this.lastSentAt.clear();
    }
    this.lastSentAt.set(key, now);
  }
}
