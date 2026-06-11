export interface ITelegramCallService {
  makeVoiceCall(userId: string): Promise<void>;
}