import type { IBusEventHandler } from "../../event-bus/domain/bus-event-handler.interface";
import type { ITelegramNotifier } from "../application/telegram.notifier.interface";
import { VIDEO_CALL_STARTED_TOPIC, type VideoCallStartedEvent } from "../events/video-call-started.event";
import { getTemplate } from "../telegram-templates";
import type { ITelegramCallService } from "../application/telegram-call.service.interface";
import { createLogger } from "../../../shared/logging/logger";

const logger = createLogger("telegram-call");

export class VideoCallTelegramHandler
  implements IBusEventHandler<VideoCallStartedEvent>
{
  readonly handles = VIDEO_CALL_STARTED_TOPIC;

  constructor(
    private readonly _telegramNotifier?: ITelegramNotifier,
    private readonly _callService?: ITelegramCallService
  ) {}

  async handle(event: VideoCallStartedEvent): Promise<void> {
    const { callerId, callType, adminTelegramId } = event.payload;

    // 1. Gửi tin nhắn text báo hiệu (Bot API)
    if (this._telegramNotifier) {
      const { text, parseMode } = getTemplate("incomingCall", {
        caller: callerId,
        type: callType,
      });
      try {
        await this._telegramNotifier.sendMessage(text, { parseMode });
      } catch (error) {
        logger.error("video call text notify failed", { err: error });
      }
    }

    // 2. Thực hiện cuộc gọi rung chuông (MTProto API)
    if (this._callService && adminTelegramId) {
      try {
        await this._callService.makeVoiceCall(adminTelegramId);
      } catch (error) {
        logger.error("video call voip failed", { err: error });
      }
    }
  }
}