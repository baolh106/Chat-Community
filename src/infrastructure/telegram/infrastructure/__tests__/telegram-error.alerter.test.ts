import type { ITelegramNotifier } from "../../application/telegram.notifier.interface";
import { TelegramErrorAlerter } from "../telegram-error.alerter";

describe("TelegramErrorAlerter", () => {
  const alert = { message: "boom", statusCode: 500, component: "API", context: "GET /x" };

  function setup() {
    let now = 1_000_000;
    const notifier: jest.Mocked<ITelegramNotifier> = {
      sendMessage: jest.fn(async () => undefined),
      sendPoll: jest.fn(),
    };
    const alerter = new TelegramErrorAlerter(notifier, 60_000, () => now);
    return { alerter, notifier, advance: (ms: number) => (now += ms) };
  }

  it("should send only once when the same error repeats within the throttle window", () => {
    const { alerter, notifier } = setup();
    alerter.alert(alert);
    alerter.alert(alert);
    alerter.alert(alert);
    expect(notifier.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("should send again when the throttle window has passed", () => {
    const { alerter, notifier, advance } = setup();
    alerter.alert(alert);
    advance(60_001);
    alerter.alert(alert);
    expect(notifier.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("should send separately when errors differ", () => {
    const { alerter, notifier } = setup();
    alerter.alert(alert);
    alerter.alert({ ...alert, context: "POST /y" });
    expect(notifier.sendMessage).toHaveBeenCalledTimes(2);
  });
});
