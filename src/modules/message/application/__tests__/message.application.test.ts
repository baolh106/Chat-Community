import type { IUnitOfWork } from "../../../../infrastructure/IUnitOfWork";
import { BadRequestError } from "../../../../shared/utils/error";
import type { IMessageRepository } from "../../domain/mesage.repository";
import type { IMessageOutboxRepository } from "../../domain/message-outbox.repository";
import type { MessageCreate } from "../dtos/param";
import { MessageApplication } from "../message.application";
import type { IFileStorage, UploadFileInput } from "../ports/file-storage.port";
import type { IImageDetectorService } from "../ports/image-detector.port";

function setup() {
  const calls: string[] = [];
  let inTx = false;
  const uow: IUnitOfWork = {
    runInTransaction: jest.fn(async (work) => {
      inTx = true;
      try {
        return await work();
      } finally {
        inTx = false;
      }
    }),
  };
  const messageRepo: jest.Mocked<IMessageRepository> = {
    ensureReady: jest.fn(),
    create: jest.fn(async () => {
      calls.push(`repo.create inTx=${inTx}`);
    }),
    insertList: jest.fn(async () => undefined),
  };
  const outboxRepo: jest.Mocked<IMessageOutboxRepository> = {
    ensureReady: jest.fn(),
    createMessageCreated: jest.fn(async () => {
      calls.push(`outbox.create inTx=${inTx}`);
    }),
    claimPending: jest.fn(),
    markProcessed: jest.fn(),
    markFailed: jest.fn(),
  };
  let n = 0;
  const fileStorage: jest.Mocked<IFileStorage> = {
    upload: jest.fn(async (file) => {
      n += 1;
      return {
        driveId: `d${n}`,
        url: `https://drive/${n}`,
        downloadUrl: null,
        name: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        type: file.mimeType.startsWith("image/") ? "image" : "file",
      };
    }),
  };
  const detector: jest.Mocked<IImageDetectorService> = {
    scanImage: jest.fn(async () => ({
      status: "ok",
      data: { is_toxic: false, confidence_score: 0.1, details: null },
    })),
  };
  const app = new MessageApplication(
    { messageRepo, uow, outboxRepo, fileStorage, imageDetector: detector },
    { maxFileSizeBytes: 1024, maxFilesPerMessage: 3 },
  );
  return { app, messageRepo, outboxRepo, fileStorage, detector, calls };
}

const base: MessageCreate = {
  sender: "bob_1",
  receiver: "admin",
  content: "hello",
  createdAt: new Date("2026-11-17T00:00:00Z"),
};

function file(name: string, mimeType = "image/png", size = 10): UploadFileInput {
  return { buffer: Buffer.alloc(size, 1), originalName: name, mimeType, size };
}

describe("MessageApplication", () => {
  it("should write message and outbox inside one transaction", async () => {
    const { app, calls } = setup();
    const created = await app.create(base);

    expect(calls).toEqual(["repo.create inTx=true", "outbox.create inTx=true"]);
    expect(created.id).toEqual(expect.any(String));
  });

  it("should reject when content and attachments are both empty", async () => {
    const { app, messageRepo } = setup();
    await expect(app.create({ ...base, content: "   " })).rejects.toBeInstanceOf(BadRequestError);
    expect(messageRepo.create).not.toHaveBeenCalled();
  });

  it("should reject when content exceeds the max length", async () => {
    const { app } = setup();
    await expect(app.create({ ...base, content: "x".repeat(4001) })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it("should keep a caller-provided id when one is given", async () => {
    const { app } = setup();
    const created = await app.create({ ...base, id: "temp-123" });
    expect(created.id).toBe("temp-123");
  });

  it("should create one message with all attachments when several files are sent", async () => {
    const { app, messageRepo, outboxRepo } = setup();

    const created = await app.createWithFiles(base, [file("a.png"), file("b.pdf", "application/pdf")]);

    expect(messageRepo.create).toHaveBeenCalledTimes(1);
    expect(outboxRepo.createMessageCreated).toHaveBeenCalledTimes(1);
    expect(created.attachments).toHaveLength(2);
    expect(created.content).toBe("hello");
    expect(created.fileName).toBe("a.png");
    expect(created.imageURL).toBe("https://drive/1");
  });

  it("should mark message unsafe when any image is flagged", async () => {
    const { app, detector } = setup();
    detector.scanImage
      .mockResolvedValueOnce({ status: "ok", data: { is_toxic: false, confidence_score: 0, details: null } })
      .mockResolvedValueOnce({ status: "ok", data: { is_toxic: true, confidence_score: 0.9, details: null } });

    const created = await app.createWithFiles(base, [file("a.png"), file("b.png")]);

    expect(created.isUnsafe).toBe(true);
    expect(created.attachments?.map((a) => a.isUnsafe)).toEqual([false, true]);
  });

  it("should still save the message when the detector is down", async () => {
    const { app, detector, messageRepo } = setup();
    detector.scanImage.mockRejectedValueOnce(new Error("timeout"));

    await app.createWithFiles(base, [file("a.png")]);

    expect(messageRepo.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["mime type not whitelisted", [file("x.exe", "application/x-msdownload")]],
    ["header injection in mime type", [file("x", "image/png\r\nX-Evil: 1")]],
    ["file too large", [file("big.png", "image/png", 2048)]],
    ["too many files", [file("1.png"), file("2.png"), file("3.png"), file("4.png")]],
    ["empty file", [file("e.png", "image/png", 0)]],
  ])("should reject without uploading when %s", async (_label, files) => {
    const { app, fileStorage } = setup();
    await expect(app.createWithFiles(base, files)).rejects.toBeInstanceOf(BadRequestError);
    expect(fileStorage.upload).not.toHaveBeenCalled();
  });

  it("should reject insertList when it exceeds the max batch size", async () => {
    const { app } = setup();
    const many = Array.from({ length: 101 }, () => base);
    await expect(app.insertList(many)).rejects.toBeInstanceOf(BadRequestError);
  });
});
