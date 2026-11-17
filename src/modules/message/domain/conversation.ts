import type { PayloadMessage } from "./dtos/payloadMessage.dto";

export const ADMIN_ID = "admin";

export function conversationKeyOf(
  message: Pick<PayloadMessage, "sender" | "receiver">,
): string {
  return message.sender === ADMIN_ID ? message.receiver : message.sender;
}
