import { Telegraf } from "telegraf";
import { createTelegramNotifier, NoopTelegramNotifier, TelegramNotifier } from "../telegram.notifier";

// Mock Telegraf
const mockSendMessage = jest.fn().mockResolvedValue(undefined);
jest.mock("telegraf", () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: {
      sendMessage: mockSendMessage,
    },
  })),
}));

// Mock env config
jest.mock("../../../../config/env", () => ({
  telegramBotToken: "test-token",
  telegramChatId: "test-chat-id",
}));

const mockLoggerError = jest.fn();
jest.mock("../../../../shared/logging/logger", () => {
  const noop = () => undefined;
  const logger = {
    debug: noop,
    info: noop,
    warn: noop,
    error: (...args: unknown[]) => mockLoggerError(...args),
    fatal: noop,
    child: () => logger,
  };
  return { createLogger: () => logger };
});

describe("TelegramNotifier", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("NoopTelegramNotifier", () => {
    it("should do nothing when sendMessage is called", async () => {
      const notifier = new NoopTelegramNotifier();

      await expect(notifier.sendMessage("test message")).resolves.toBeUndefined();
    });
  });

  describe("TelegramNotifier", () => {
    it("should send message successfully", async () => {
      const notifier = new TelegramNotifier("test-token", "test-chat-id");

      await notifier.sendMessage("test message");

      expect(mockSendMessage).toHaveBeenCalledWith("test-chat-id", "test message", undefined);
    });

    it("should handle sendMessage error gracefully", async () => {
      mockSendMessage.mockRejectedValueOnce(new Error("Network error"));
      const notifier = new TelegramNotifier("test-token", "test-chat-id");

      await notifier.sendMessage("test message");

      expect(mockSendMessage).toHaveBeenCalledWith("test-chat-id", "test message", undefined);
      expect(mockLoggerError).toHaveBeenCalledWith("failed to send telegram message", {
        err: expect.any(Error),
      });
    });

    it("should not send message if chatId is empty", async () => {
      const notifier = new TelegramNotifier("test-token", "");

      await notifier.sendMessage("test message");

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("createTelegramNotifier", () => {
    it("should return TelegramNotifier when both token and chatId are present", () => {
      const notifier = createTelegramNotifier();

      expect(notifier).toBeInstanceOf(TelegramNotifier);
    });

    // Note: Testing the NoopTelegramNotifier cases requires different env setups
    // which is complex with Jest mocking. These would be better tested with integration tests
    // or by testing the logic directly in a separate test file with different env mocks.
  });
});