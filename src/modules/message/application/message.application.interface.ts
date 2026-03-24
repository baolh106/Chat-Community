import type { MessageCreate } from "./dtos/param";

export interface IMessageApplication {
  create(req: MessageCreate): Promise<void>;
  insertList(arrReq: MessageCreate[]): Promise<void>;
}
