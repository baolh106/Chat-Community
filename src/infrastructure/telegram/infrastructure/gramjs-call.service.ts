import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import type { ITelegramCallService } from "../application/telegram-call.service.interface";
import { telegramAppHash, telegramAppId, telegramHelperSession } from "../../../config/env";

export class GramJsCallService implements ITelegramCallService {
  private client: TelegramClient;
  private readonly apiId: number;
  private readonly apiHash: string;
  private readonly stringSession: string;

  constructor() {
    this.apiId = Number(telegramAppId);
    this.apiHash = telegramAppHash;
    this.stringSession = telegramHelperSession;
    
    this.client = new TelegramClient(
      new StringSession(this.stringSession),
      this.apiId,
      this.apiHash,
      { connectionRetries: 5 }
    );
  }

  async makeVoiceCall(targetId: string): Promise<void> {
    try {
      if (!this.client.connected) {
        await this.client.connect();
      }

      // Cần lấy Entity của account chính để Telegram xác thực và lấy access_hash
      const userEntity = await this.client.getEntity(targetId);

      // Khởi tạo cuộc gọi VoIP
      // Lưu ý: Telegram yêu cầu xử lý giao thức WebRTC/Signaling phức tạp để duy trì cuộc gọi
      // Ở mức độ "gây chú ý", chúng ta gửi yêu cầu RequestCall
      await this.client.invoke(
        new Api.phone.RequestCall({
          userId: userEntity,
          randomId: Math.floor(Math.random() * 1000000),
          gAHash: Buffer.alloc(32), 
          protocol: new Api.PhoneCallProtocol({
            minLayer: 65,
            maxLayer: 65,
            libraryVersions: ["1.0.0"],
            udpP2p: true,
            udpReflector: true,
          }),
        })
      );
      console.log(`[GramJsCallService] Triggered call to ${targetId}`);
    } catch (error) {
      console.error("[GramJsCallService] Failed to initiate call:", error);
    }
  }
}