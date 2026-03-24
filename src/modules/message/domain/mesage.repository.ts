import type { PayloadMessage } from "./dtos/payloadMessage.dto";

export interface IMessageRepository {
  create(payload: PayloadMessage): Promise<void>;
  insertList(payload: PayloadMessage[]): Promise<void>;
}
