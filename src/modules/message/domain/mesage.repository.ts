import type { PayloadMessage } from "./dtos/payloadMessage.dto";

export interface IMessageRepository {
  ensureReady(): Promise<void>;
  create(payload: PayloadMessage): Promise<void>;
  insertList(payload: PayloadMessage[]): Promise<void>;
}
