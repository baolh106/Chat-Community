import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type LogContextValue = string | number | boolean | undefined;
export type LogContext = Record<string, LogContextValue>;

const storage = new AsyncLocalStorage<LogContext>();

export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  const parent = storage.getStore();
  return storage.run({ ...parent, ...definedOnly(context) }, fn);
}

export function addLogContext(context: LogContext): void {
  const store = storage.getStore();
  if (store) {
    Object.assign(store, definedOnly(context));
  }
}

export function getLogContext(): Readonly<LogContext> | undefined {
  return storage.getStore();
}

export function currentRequestId(): string | undefined {
  const value = storage.getStore()?.requestId;
  return typeof value === "string" ? value : undefined;
}

export function newRequestId(): string {
  return randomUUID();
}

function definedOnly(context: LogContext): LogContext {
  const result: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
