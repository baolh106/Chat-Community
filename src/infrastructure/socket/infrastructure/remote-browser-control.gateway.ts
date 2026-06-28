// import { randomUUID } from "node:crypto";
// import type { Server, Socket } from "socket.io";
// import { userRoom } from "../domain/room-name";
// import type { SocketSessionData } from "../domain/socket-session.types";
// import { logSocketGateway } from "./socket-gateway.log";

// type RemoteSessionStatus = "pending" | "active" | "ended";
// type RemoteSessionMode = "view" | "control";

// type RemoteSession = {
//   id: string;
//   userId: string;
//   adminSocketId: string;
//   userSocketId?: string;
//   mode: RemoteSessionMode;
//   status: RemoteSessionStatus;
//   createdAt: string;
//   expiresAt: number;
//   timeout: NodeJS.Timeout;
// };

// type RemoteRequestPayload = {
//   userId?: string;
//   mode?: RemoteSessionMode;
//   reason?: string;
// };

// type RemoteSessionPayload = {
//   sessionId?: string;
// };

// type RemoteSignalPayload = RemoteSessionPayload & {
//   type?: string;
//   data?: unknown;
// };

// type RemoteControlPayload = RemoteSessionPayload & {
//   action?: string;
//   data?: unknown;
//   sequence?: number;
// };

// const REMOTE_ERROR = "remote:error";
// const REMOTE_SESSION_TTL_MS = 60_000;
// const REMOTE_PAYLOAD_MAX_BYTES = 64 * 1024;

// const remoteRoom = (sessionId: string): string => `remote:${sessionId}`;

// const isObjectPayload = (
//   payload: unknown,
// ): payload is Record<string, unknown> =>
//   typeof payload === "object" && payload !== null;

// const emitRemoteError = (
//   socket: Socket,
//   reason: string,
//   sessionId?: string,
// ): void => {
//   socket.emit(REMOTE_ERROR, {
//     ok: false,
//     reason,
//     ...(sessionId ? { sessionId } : {}),
//   });
// };

// const normalizeNonEmptyString = (value: unknown): string | undefined => {
//   if (typeof value !== "string") {
//     return undefined;
//   }

//   const normalized = value.trim();
//   return normalized.length > 0 ? normalized : undefined;
// };

// const getPayloadSize = (payload: unknown): number => {
//   try {
//     return Buffer.byteLength(JSON.stringify(payload));
//   } catch {
//     return REMOTE_PAYLOAD_MAX_BYTES + 1;
//   }
// };

// const isValidMode = (mode: unknown): mode is RemoteSessionMode =>
//   mode === "view" || mode === "control";

// export function registerRemoteBrowserControlGateway(io: Server): void {
//   const sessions = new Map<string, RemoteSession>();

//   const emitToUserSockets = async (
//     userId: string,
//     event: string,
//     payload: unknown,
//   ): Promise<void> => {
//     const sockets = await io.in(userRoom(userId)).fetchSockets();
//     for (const remote of sockets) {
//       const session = remote.data as SocketSessionData;
//       if (session?.role === "user" && session?.userId === userId) {
//         remote.emit(event, payload);
//       }
//     }
//   };

//   const endSession = (
//     session: RemoteSession,
//     reason: string,
//     endedBy: "admin" | "user" | "system",
//   ): void => {
//     if (session.status === "ended") {
//       return;
//     }

//     session.status = "ended";
//     clearTimeout(session.timeout);
//     sessions.delete(session.id);
//     const payload = {
//       ok: true,
//       sessionId: session.id,
//       reason,
//       endedBy,
//       timestamp: new Date().toISOString(),
//     };

//     let target = io.to(remoteRoom(session.id)).to(session.adminSocketId);
//     if (session.userSocketId) {
//       target = target.to(session.userSocketId);
//     }
//     target.emit("remote:ended", payload);
//   };

//   const getAuthorizedSession = (
//     socket: Socket & { data: SocketSessionData },
//     payload: unknown,
//     expectedStatus?: RemoteSessionStatus,
//   ): RemoteSession | undefined => {
//     if (!isObjectPayload(payload)) {
//       emitRemoteError(socket, "invalid_payload");
//       return undefined;
//     }

//     const sessionId = normalizeNonEmptyString(payload.sessionId);
//     if (!sessionId) {
//       emitRemoteError(socket, "session_id_required");
//       return undefined;
//     }

//     const session = sessions.get(sessionId);
//     if (!session) {
//       emitRemoteError(socket, "session_not_found", sessionId);
//       return undefined;
//     }

//     if (expectedStatus && session.status !== expectedStatus) {
//       emitRemoteError(socket, "invalid_session_status", sessionId);
//       return undefined;
//     }

//     const isAdminParticipant =
//       socket.data.role === "admin" && socket.id === session.adminSocketId;
//     const isUserParticipant =
//       socket.data.role === "user" && socket.data.userId === session.userId;

//     if (!isAdminParticipant && !isUserParticipant) {
//       emitRemoteError(socket, "forbidden", sessionId);
//       return undefined;
//     }

//     return session;
//   };

//   io.on("connection", (socket) => {
//     const s = socket as Socket & { data: SocketSessionData };

//     s.on("remote:request", async (payload: RemoteRequestPayload) => {
//       if (s.data.role !== "admin") {
//         emitRemoteError(s, "unauthorized");
//         return;
//       }

//       if (!isObjectPayload(payload)) {
//         emitRemoteError(s, "invalid_payload");
//         return;
//       }

//       const userId = normalizeNonEmptyString(payload.userId);
//       if (!userId) {
//         emitRemoteError(s, "user_id_required");
//         return;
//       }

//       const userSockets = await io.in(userRoom(userId)).fetchSockets();
//       const onlineUserSockets = userSockets.filter((remote) => {
//         const session = remote.data as SocketSessionData;
//         return session?.role === "user" && session?.userId === userId;
//       });

//       if (onlineUserSockets.length === 0) {
//         s.emit("remote:request:ack", {
//           ok: false,
//           reason: "user_offline",
//           userId,
//         });
//         return;
//       }

//       const mode = isValidMode(payload.mode) ? payload.mode : "control";
//       const sessionId = randomUUID();
//       const createdAt = new Date().toISOString();
//       const expiresAt = Date.now() + REMOTE_SESSION_TTL_MS;
//       const session: RemoteSession = {
//         id: sessionId,
//         userId,
//         adminSocketId: s.id,
//         mode,
//         status: "pending",
//         createdAt,
//         expiresAt,
//         timeout: setTimeout(() => {
//           const pendingSession = sessions.get(sessionId);
//           if (pendingSession?.status === "pending") {
//             endSession(pendingSession, "request_timeout", "system");
//           }
//         }, REMOTE_SESSION_TTL_MS),
//       };

//       sessions.set(sessionId, session);

//       await emitToUserSockets(userId, "remote:request", {
//         sessionId,
//         userId,
//         mode,
//         reason: normalizeNonEmptyString(payload.reason),
//         createdAt,
//         expiresAt: new Date(expiresAt).toISOString(),
//       });

//       s.emit("remote:request:ack", {
//         ok: true,
//         sessionId,
//         userId,
//         mode,
//         expiresAt: new Date(expiresAt).toISOString(),
//       });

//       logSocketGateway("remote request", {
//         socketId: s.id,
//         role: "admin",
//         detail: `session=${sessionId} user=${userId} mode=${mode}`,
//       });
//     });

//     s.on("remote:accept", async (payload: RemoteSessionPayload) => {
//       const session = getAuthorizedSession(s, payload, "pending");
//       if (!session || s.data.role !== "user") {
//         return;
//       }

//       session.status = "active";
//       session.userSocketId = s.id;
//       clearTimeout(session.timeout);

//       const room = remoteRoom(session.id);
//       await Promise.all([
//         io.in(session.adminSocketId).socketsJoin(room),
//         s.join(room),
//       ]);

//       io.to(room).emit("remote:accepted", {
//         ok: true,
//         sessionId: session.id,
//         userId: session.userId,
//         mode: session.mode,
//         timestamp: new Date().toISOString(),
//       });
//     });

//     s.on("remote:reject", (payload: RemoteSessionPayload) => {
//       const session = getAuthorizedSession(s, payload, "pending");
//       if (!session || s.data.role !== "user") {
//         return;
//       }

//       io.to(session.adminSocketId).emit("remote:rejected", {
//         ok: true,
//         sessionId: session.id,
//         userId: session.userId,
//         timestamp: new Date().toISOString(),
//       });
//       endSession(session, "rejected", "user");
//     });

//     s.on("remote:cancel", (payload: RemoteSessionPayload) => {
//       const session = getAuthorizedSession(s, payload);
//       if (!session || s.data.role !== "admin") {
//         return;
//       }

//       endSession(session, "cancelled", "admin");
//     });

//     s.on("remote:end", (payload: RemoteSessionPayload) => {
//       const session = getAuthorizedSession(s, payload);
//       if (!session) {
//         return;
//       }

//       endSession(
//         session,
//         "completed",
//         s.data.role === "admin" ? "admin" : "user",
//       );
//     });

//     s.on("remote:signal", (payload: RemoteSignalPayload) => {
//       const session = getAuthorizedSession(s, payload, "active");
//       const type = normalizeNonEmptyString(payload?.type);
//       if (!session || !type) {
//         emitRemoteError(s, "signal_type_required");
//         return;
//       }

//       if (getPayloadSize(payload.data) > REMOTE_PAYLOAD_MAX_BYTES) {
//         emitRemoteError(s, "payload_too_large", session.id);
//         return;
//       }

//       s.to(remoteRoom(session.id)).emit("remote:signal", {
//         sessionId: session.id,
//         from: s.data.role,
//         type,
//         data: payload.data,
//       });
//     });

//     s.on("remote:control", (payload: RemoteControlPayload) => {
//       const session = getAuthorizedSession(s, payload, "active");
//       const action = normalizeNonEmptyString(payload?.action);
//       if (!session || !action) {
//         emitRemoteError(s, "control_action_required");
//         return;
//       }

//       if (s.data.role !== "admin") {
//         emitRemoteError(s, "admin_only", session.id);
//         return;
//       }

//       if (session.mode !== "control") {
//         emitRemoteError(s, "view_only_session", session.id);
//         return;
//       }

//       if (getPayloadSize(payload.data) > REMOTE_PAYLOAD_MAX_BYTES) {
//         emitRemoteError(s, "payload_too_large", session.id);
//         return;
//       }

//       s.to(remoteRoom(session.id)).emit("remote:control", {
//         sessionId: session.id,
//         action,
//         data: payload.data,
//         sequence: payload.sequence,
//         timestamp: new Date().toISOString(),
//       });
//     });

//     s.on("remote:control:ack", (payload: RemoteControlPayload) => {
//       const session = getAuthorizedSession(s, payload, "active");
//       if (!session || s.data.role !== "user") {
//         return;
//       }

//       io.to(session.adminSocketId).emit("remote:control:ack", {
//         sessionId: session.id,
//         action: normalizeNonEmptyString(payload.action),
//         data: payload.data,
//         sequence: payload.sequence,
//         timestamp: new Date().toISOString(),
//       });
//     });

//     s.on("disconnect", () => {
//       for (const session of sessions.values()) {
//         const isAdmin = s.id === session.adminSocketId;
//         const isUser =
//           s.data.role === "user" && s.data.userId === session.userId;

//         if (isAdmin || isUser) {
//           endSession(session, "participant_disconnected", "system");
//         }
//       }
//     });
//   });
// }
