import type { IMessageApplication } from "../../../../modules/message/application/message.application.interface";
import { BadRequestError } from "../../../../shared/utils/error";
import type { SocketSessionData } from "../../domain/socket-session.types";
import { createMessageSendHandler, type MessageSocket } from "../socket-message.handler";

function fakeSocket(data: SocketSessionData) {
  const emitted: Array<[string, unknown]> = [];
  const broadcast: Array<[string, string, unknown]> = [];
  const socket: MessageSocket = {
    data,
    emit: (event, payload) => emitted.push([event, payload]),
    to: (room) => ({ emit: (event, payload) => broadcast.push([room, event, payload]) }),
  };
  return { socket, emitted, broadcast };
}

function setup() {
  const messageApp: jest.Mocked<IMessageApplication> = {
    create: jest.fn(async (m) => m),
    createWithFiles: jest.fn(async (m, files) => ({
      ...m,
      attachments: files.map((f, i) => ({
        fileURL: `u${i}`,
        fileDownloadURL: null,
        fileName: f.originalName,
        fileMimeType: f.mimeType,
        fileSize: f.size,
        fileDriveId: `d${i}`,
        attachmentType: "image" as const,
      })),
    })),
    insertList: jest.fn(),
    getMessages: jest.fn(),
    markMessagesAsRead: jest.fn(),
    getUnreadCount: jest.fn(),
  };
  const handler = createMessageSendHandler({
    messageApp,
    maxFileSizeBytes: 1024,
    maxFilesPerMessage: 2,
  });
  return { handler, messageApp };
}

const user = { role: "user", userId: "bob_1" } as const;
const base64Png = Buffer.from("png-bytes").toString("base64");

describe("message:send handler", () => {
  it("should reject when a user sends to another user", async () => {
    const { handler, messageApp } = setup();
    const { socket, emitted, broadcast } = fakeSocket({ ...user });

    await handler(socket, { receiver: "alice_2", content: "hi" });

    expect(emitted).toEqual([["message:error", { ok: false, reason: "receiver_not_allowed" }]]);
    expect(broadcast).toHaveLength(0);
    expect(messageApp.create).not.toHaveBeenCalled();
  });

  it("should reject when an admin sends to admin", async () => {
    const { handler } = setup();
    const { socket, emitted } = fakeSocket({ role: "admin" });
    await handler(socket, { receiver: "admin", content: "hi" });
    expect(emitted[0]?.[1]).toMatchObject({ reason: "receiver_not_allowed" });
  });

  it("should not broadcast when content is empty", async () => {
    const { handler, messageApp } = setup();
    const { socket, emitted, broadcast } = fakeSocket({ ...user });

    await handler(socket, { receiver: "admin", content: "   " });

    expect(emitted[0]?.[1]).toMatchObject({ ok: false, reason: "invalid_payload" });
    expect(broadcast).toHaveLength(0);
    expect(messageApp.create).not.toHaveBeenCalled();
  });

  it("should reject when payload is not an object", async () => {
    const { handler } = setup();
    const { socket, emitted } = fakeSocket({ ...user });
    await handler(socket, "garbage");
    expect(emitted[0]?.[1]).toMatchObject({ reason: "invalid_payload" });
  });

  it("should broadcast, ack and persist with the same id when text is valid", async () => {
    const { handler, messageApp } = setup();
    const { socket, emitted, broadcast } = fakeSocket({ ...user });

    await handler(socket, { receiver: "admin", content: "hello", sender: "admin" });

    expect(broadcast[0]?.[0]).toBe("admin");
    const ack = emitted.find(([e]) => e === "message:send:ack")?.[1] as { tempId: string };
    const persisted = messageApp.create.mock.calls[0]![0];
    expect(persisted.id).toBe(ack.tempId);
    expect(persisted.sender).toBe("bob_1");
  });

  it("should emit message:error with tempId when persisting fails", async () => {
    const { handler, messageApp } = setup();
    messageApp.create.mockRejectedValueOnce(new Error("mongo down"));
    const { socket, emitted } = fakeSocket({ ...user });

    await handler(socket, { receiver: "admin", content: "hello" });

    const ack = emitted.find(([e]) => e === "message:send:ack")?.[1] as { tempId: string };
    expect(emitted.at(-1)).toEqual([
      "message:error",
      { ok: false, tempId: ack.tempId, reason: "persist_failed" },
    ]);
  });

  it("should create a single message with attachments when files are sent", async () => {
    const { handler, messageApp } = setup();
    const { socket, broadcast } = fakeSocket({ ...user });

    await handler(socket, {
      receiver: "admin",
      content: "see",
      files: [
        { data: `data:image/png;base64,${base64Png}`, name: "a.png", mimeType: "image/png" },
        { data: base64Png, name: "b.png", mimeType: "image/png" },
      ],
    });

    expect(messageApp.createWithFiles).toHaveBeenCalledTimes(1);
    expect(messageApp.createWithFiles.mock.calls[0]![1]).toHaveLength(2);
    expect(broadcast[0]?.[2]).toMatchObject({ hasAttachments: true, content: "see" });
  });

  it("should reject a file before decoding when it is too large", async () => {
    const { handler, messageApp } = setup();
    const { socket, emitted } = fakeSocket({ ...user });

    await handler(socket, {
      receiver: "admin",
      files: [{ data: "A".repeat(4000), name: "big.png", mimeType: "image/png" }],
    });

    expect(messageApp.createWithFiles).not.toHaveBeenCalled();
    expect(emitted.at(-1)?.[1]).toMatchObject({ ok: false, reason: "File too large: big.png" });
  });

  it("should hide internal error details when upload fails unexpectedly", async () => {
    const { handler, messageApp } = setup();
    messageApp.createWithFiles.mockRejectedValueOnce(new Error("google raw error body"));
    const { socket, emitted } = fakeSocket({ ...user });

    await handler(socket, {
      receiver: "admin",
      files: [{ data: base64Png, name: "a.png", mimeType: "image/png" }],
    });

    expect(emitted.at(-1)?.[1]).toMatchObject({ reason: "upload_failed" });
  });

  it("should pass through business validation messages when upload is rejected", async () => {
    const { handler, messageApp } = setup();
    messageApp.createWithFiles.mockRejectedValueOnce(new BadRequestError("File type not allowed: x"));
    const { socket, emitted } = fakeSocket({ ...user });

    await handler(socket, {
      receiver: "admin",
      files: [{ data: base64Png, name: "a.exe", mimeType: "application/x-msdownload" }],
    });

    expect(emitted.at(-1)?.[1]).toMatchObject({ reason: "File type not allowed: x" });
  });

  it("should reject when the socket has no identity", async () => {
    const { handler } = setup();
    const { socket, emitted } = fakeSocket({ role: "user" });
    await handler(socket, { receiver: "admin", content: "hi" });
    expect(emitted[0]?.[1]).toMatchObject({ reason: "unauthorized" });
  });
});
