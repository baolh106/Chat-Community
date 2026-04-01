const PREFIX = "[SocketGateway]";

export type SocketGatewayLogPayload = {
  socketId: string;
  /** Có khi socket đã user:join thành công. */
  userId?: string;
  /** Có khi đã xác định role. */
  role?: "admin" | "user";
  /** Lý do disconnect (Socket.IO). */
  reason?: string;
  /** Thông tin thêm (denied reason, v.v.). */
  detail?: string;
};

export function logSocketGateway(
  message: string,
  payload: SocketGatewayLogPayload,
): void {
  console.log(`${PREFIX} ${message}`, payload);
}
