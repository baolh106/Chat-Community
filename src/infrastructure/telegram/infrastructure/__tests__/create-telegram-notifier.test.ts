import { createTelegramNotifier, TelegramNotifier } from "../telegram.notifier";

// Test createTelegramNotifier with default env configuration
describe("createTelegramNotifier", () => {
  it("should return TelegramNotifier when env vars are configured (default test setup)", () => {
    const notifier = createTelegramNotifier();

    expect(notifier).toBeInstanceOf(TelegramNotifier);
  });

  // Note: Testing different env configurations requires complex mocking
  // For now, we test the happy path. In production, the env vars control
  // whether TelegramNotifier or NoopTelegramNotifier is returned.
});