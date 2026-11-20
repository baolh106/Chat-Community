import { Writable } from "node:stream";
import pino from "pino";
import { REDACT_PATHS } from "../logger";

function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const logger = pino({ redact: { paths: REDACT_PATHS, censor: "[REDACTED]" } }, stream);
  return { logger, lines };
}

describe("logger redaction", () => {
  it("should redact sensitive keys at top level and nested levels", () => {
    const { logger, lines } = captureLogger();

    logger.info(
      {
        password: "p1",
        user: { refreshToken: "r1", name: "bob" },
        req: { headers: { authorization: "Bearer x", cookie: "sid=1" } },
      },
      "msg",
    );

    const entry = JSON.parse(lines[0] ?? "{}");
    expect(entry.password).toBe("[REDACTED]");
    expect(entry.user).toEqual({ refreshToken: "[REDACTED]", name: "bob" });
    expect(entry.req.headers).toEqual({ authorization: "[REDACTED]", cookie: "[REDACTED]" });
  });
});
