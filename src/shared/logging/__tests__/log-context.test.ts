import {
  addLogContext,
  currentRequestId,
  getLogContext,
  runWithLogContext,
} from "../log-context";

describe("log-context", () => {
  it("should return undefined outside of a context", () => {
    expect(getLogContext()).toBeUndefined();
    expect(currentRequestId()).toBeUndefined();
  });

  it("should expose the context across async boundaries", async () => {
    const seen = await runWithLogContext({ requestId: "req-12345678" }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return currentRequestId();
    });

    expect(seen).toBe("req-12345678");
  });

  it("should merge nested contexts without leaking to the parent", () => {
    runWithLogContext({ requestId: "outer-1234", userId: "u1" }, () => {
      runWithLogContext({ eventId: "evt-1", userId: undefined }, () => {
        expect(getLogContext()).toEqual({ requestId: "outer-1234", userId: "u1", eventId: "evt-1" });
      });
      expect(getLogContext()).toEqual({ requestId: "outer-1234", userId: "u1" });
    });
  });

  it("should add fields to the current context only", () => {
    runWithLogContext({ requestId: "req-abcdefgh" }, () => {
      addLogContext({ userId: "bob_1", role: undefined });
      expect(getLogContext()).toEqual({ requestId: "req-abcdefgh", userId: "bob_1" });
    });

    addLogContext({ userId: "ignored" });
    expect(getLogContext()).toBeUndefined();
  });
});
