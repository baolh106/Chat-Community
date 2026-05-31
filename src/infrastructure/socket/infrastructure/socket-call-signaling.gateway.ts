import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { ADMIN_ROOM, userRoom } from "../domain/room-name";
import type { SocketSessionData } from "../domain/socket-session.types";
import { logSocketGateway } from "./socket-gateway.log";

type CallMediaType = "audio" | "video";
type CallEndReason = "completed" | "cancelled" | "declined" | "busy" | "failed";

type CallInvitePayload = {
  callId?: string;
  receiver: string;
  mediaType?: CallMediaType;
  offer?: unknown;
};

type CallSignalPayload = {
  callId: string;
  receiver: string;
  answer?: unknown;
  candidate?: unknown;
  reason?: CallEndReason | string;
};

type CallForwardPayload = {
  callId: string;
  caller: string;
  receiver: string;
  mediaType: CallMediaType;
  createdAt: string;
  offer?: unknown;
};

type CallRelayPayload = {
  callId: string;
  from: string;
  receiver: string;
  createdAt: string;
  answer?: unknown;
  candidate?: unknown;
  reason?: CallEndReason | string;
};

const CALL_ERROR = "call:error";

const isObjectPayload = (
  payload: unknown,
): payload is Record<string, unknown> =>
  typeof payload === "object" && payload !== null;

const getCallerId = (socket: Socket & { data: SocketSessionData }) => {
  if (socket.data.role === "admin") {
    return "admin";
  }

  return socket.data.userId;
};

const isAllowedReceiver = (
  callerRole: SocketSessionData["role"],
  receiver: string,
) => {
  if (callerRole === "admin") {
    return receiver !== "admin";
  }

  return receiver === "admin";
};

const emitCallError = (
  socket: Socket,
  reason: string,
  callId?: string,
): void => {
  socket.emit(CALL_ERROR, {
    ok: false,
    reason,
    ...(callId ? { callId } : {}),
  });
};

const parseReceiver = (payload: unknown): string | undefined => {
  if (!isObjectPayload(payload) || typeof payload.receiver !== "string") {
    return undefined;
  }

  const receiver = payload.receiver.trim();
  return receiver.length > 0 ? receiver : undefined;
};

async function emitToCallReceiver(
  io: Server,
  senderSocketId: string,
  receiver: string,
  event: string,
  payload: CallForwardPayload | CallRelayPayload,
): Promise<number> {
  if (receiver === "admin") {
    const sockets = await io.in(ADMIN_ROOM).fetchSockets();
    let delivered = 0;
    for (const remote of sockets) {
      if (remote.id === senderSocketId) continue;
      remote.emit(event, payload);
      delivered += 1;
    }
    return delivered;
  }

  const sockets = await io.in(userRoom(receiver)).fetchSockets();
  let delivered = 0;
  for (const remote of sockets) {
    if (remote.id === senderSocketId) continue;
    const session = remote.data as SocketSessionData;
    if (session?.role === "user" && session?.userId === receiver) {
      remote.emit(event, payload);
      delivered += 1;
    }
  }
  return delivered;
}

async function relayCallEvent(
  io: Server,
  socket: Socket & { data: SocketSessionData },
  event: string,
  targetEvent: string,
  payload: unknown,
): Promise<void> {
  const caller = getCallerId(socket);
  const receiver = parseReceiver(payload);

  if (!socket.data.role || !caller) {
    emitCallError(socket, "unauthorized");
    return;
  }

  if (!receiver || !isObjectPayload(payload)) {
    emitCallError(socket, "invalid_payload");
    return;
  }

  if (!isAllowedReceiver(socket.data.role, receiver)) {
    emitCallError(socket, "receiver_not_allowed");
    return;
  }

  if (
    typeof payload.callId !== "string" ||
    payload.callId.trim().length === 0
  ) {
    emitCallError(socket, "call_id_required");
    return;
  }

  const body: CallRelayPayload = {
    callId: payload.callId.trim(),
    from: caller,
    receiver,
    createdAt: new Date().toISOString(),
    ...(payload.answer !== undefined ? { answer: payload.answer } : {}),
    ...(payload.candidate !== undefined
      ? { candidate: payload.candidate }
      : {}),
    ...(payload.reason !== undefined ? { reason: String(payload.reason) } : {}),
  };

  const delivered = await emitToCallReceiver(
    io,
    socket.id,
    receiver,
    targetEvent,
    body,
  );

  socket.emit(`${event}:ack`, {
    ok: true,
    callId: body.callId,
    delivered,
  });
}

export function registerSocketCallSignalingGateway(io: Server): void {
  io.on("connection", (socket) => {
    const s = socket as Socket & { data: SocketSessionData };

    s.on("call:invite", async (payload: CallInvitePayload) => {
      const caller = getCallerId(s);
      const receiver = parseReceiver(payload);

      if (!s.data.role || !caller) {
        emitCallError(s, "unauthorized");
        return;
      }

      if (!receiver || !isObjectPayload(payload)) {
        emitCallError(s, "invalid_payload");
        return;
      }

      if (!isAllowedReceiver(s.data.role, receiver)) {
        emitCallError(s, "receiver_not_allowed");
        return;
      }

      const callId =
        typeof payload.callId === "string" && payload.callId.trim().length > 0
          ? payload.callId.trim()
          : randomUUID();

      const body: CallForwardPayload = {
        callId,
        caller,
        receiver,
        mediaType: payload.mediaType === "audio" ? "audio" : "video",
        createdAt: new Date().toISOString(),
        ...(payload.offer !== undefined ? { offer: payload.offer } : {}),
      };

      const delivered = await emitToCallReceiver(
        io,
        s.id,
        receiver,
        "call:incoming",
        body,
      );

      s.emit("call:invite:ack", {
        ok: true,
        callId,
        delivered,
      });

      logSocketGateway("call invite", {
        socketId: s.id,
        userId: caller,
        role: s.data.role,
        detail: `${caller} -> ${receiver} delivered=${delivered}`,
      });
    });

    s.on("call:accept", (payload: CallSignalPayload) => {
      void relayCallEvent(io, s, "call:accept", "call:accepted", payload);
    });

    s.on("call:reject", (payload: CallSignalPayload) => {
      void relayCallEvent(io, s, "call:reject", "call:rejected", payload);
    });

    s.on("call:cancel", (payload: CallSignalPayload) => {
      void relayCallEvent(io, s, "call:cancel", "call:cancelled", payload);
    });

    s.on("call:end", (payload: CallSignalPayload) => {
      void relayCallEvent(io, s, "call:end", "call:ended", payload);
    });

    s.on("call:ice-candidate", (payload: CallSignalPayload) => {
      void relayCallEvent(
        io,
        s,
        "call:ice-candidate",
        "call:ice-candidate",
        payload,
      );
    });
  });
}
