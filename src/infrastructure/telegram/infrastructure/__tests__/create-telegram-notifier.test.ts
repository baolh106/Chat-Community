import type * as NotifierModule from "../telegram.notifier";

function loadWithEnv(env: { telegramBotToken: string; telegramChatId: string }) {
  let mod: typeof NotifierModule | undefined;
  jest.isolateModules(() => {
    jest.doMock("../../../../config/env", () => ({
      ...jest.requireActual("../../../../config/env"),
      ...env,
    }));
    jest.doMock("telegraf", () => ({ Telegraf: jest.fn(() => ({ telegram: {} })) }));
    mod = jest.requireActual("../telegram.notifier");
  });
  return mod!;
}

describe("createTelegramNotifier", () => {
  afterEach(() => {
    jest.resetModules();
  });

  it("should return TelegramNotifier when token and chat id are configured", () => {
    const mod = loadWithEnv({ telegramBotToken: "t", telegramChatId: "c" });
    expect(mod.createTelegramNotifier()).toBeInstanceOf(mod.TelegramNotifier);
  });

  it("should return NoopTelegramNotifier when token is missing", () => {
    const mod = loadWithEnv({ telegramBotToken: "", telegramChatId: "c" });
    expect(mod.createTelegramNotifier()).toBeInstanceOf(mod.NoopTelegramNotifier);
  });

  it("should return NoopTelegramNotifier when chat id is missing", () => {
    const mod = loadWithEnv({ telegramBotToken: "t", telegramChatId: "" });
    expect(mod.createTelegramNotifier()).toBeInstanceOf(mod.NoopTelegramNotifier);
  });
});
