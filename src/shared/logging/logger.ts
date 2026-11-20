import pino from "pino";
import type { Logger as PinoLogger, LoggerOptions } from "pino";
import { logLevel, logPretty, nodeEnv, serviceName } from "../../config/env";
import { getLogContext } from "./log-context";
import type { ILogger, LogFields } from "./logger.interface";

const SENSITIVE_KEYS = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "privateKey",
  "apiKey",
  "authorization",
  "cookie",
];

export const REDACT_PATHS = [
  ...SENSITIVE_KEYS,
  ...SENSITIVE_KEYS.map((key) => `*.${key}`),
  ...SENSITIVE_KEYS.map((key) => `*.*.${key}`),
];

function buildOptions(): LoggerOptions {
  const options: LoggerOptions = {
    level: logLevel,
    base: { service: serviceName, env: nodeEnv },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: "msg",
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    serializers: { err: pino.stdSerializers.err, error: pino.stdSerializers.err },
    mixin: () => ({ ...getLogContext() }),
  };

  if (logPretty) {
    options.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname,service,env",
      },
    };
  } else {
    options.formatters = { level: (label) => ({ level: label }) };
  }

  return options;
}

export const rootLogger: PinoLogger = pino(buildOptions());

type WritableLevel = "debug" | "info" | "warn" | "error" | "fatal";

class PinoLoggerAdapter implements ILogger {
  constructor(private readonly _logger: PinoLogger) {}

  debug(message: string, fields?: LogFields): void {
    this.write("debug", message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.write("info", message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.write("warn", message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.write("error", message, fields);
  }

  fatal(message: string, fields?: LogFields): void {
    this.write("fatal", message, fields);
  }

  child(bindings: LogFields): ILogger {
    return new PinoLoggerAdapter(this._logger.child(bindings));
  }

  private write(level: WritableLevel, message: string, fields?: LogFields): void {
    if (fields) {
      this._logger[level](fields, message);
    } else {
      this._logger[level](message);
    }
  }
}

export function createLogger(module: string): ILogger {
  return new PinoLoggerAdapter(rootLogger.child({ module }));
}
