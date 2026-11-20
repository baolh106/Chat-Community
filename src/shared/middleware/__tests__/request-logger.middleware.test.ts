import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { currentRequestId } from "../../logging/log-context";
import {
  createRequestLogger,
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "../request-logger.middleware";

describe("resolveRequestId", () => {
  it("should keep a well-formed incoming id", () => {
    expect(resolveRequestId("abc-1234_XYZ")).toBe("abc-1234_XYZ");
    expect(resolveRequestId(["abc-1234_XYZ", "other-id-99"])).toBe("abc-1234_XYZ");
  });

  it("should generate a new id for missing or malformed input", () => {
    const uuid = /^[0-9a-f-]{36}$/;
    expect(resolveRequestId(undefined)).toMatch(uuid);
    expect(resolveRequestId("short")).toMatch(uuid);
    expect(resolveRequestId("bad id\nwith newline")).toMatch(uuid);
    expect(resolveRequestId("x".repeat(65))).toMatch(uuid);
  });
});

describe("createRequestLogger", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(createRequestLogger());
    app.get("/ctx", async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      res.json({ requestId: currentRequestId() });
    });
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("should echo a valid incoming request id and expose it to handlers", async () => {
    const res = await fetch(`${baseUrl}/ctx`, { headers: { [REQUEST_ID_HEADER]: "client-req-0001" } });

    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("client-req-0001");
    expect(await res.json()).toEqual({ requestId: "client-req-0001" });
  });

  it("should generate a request id when none is provided", async () => {
    const res = await fetch(`${baseUrl}/ctx`);
    const header = res.headers.get(REQUEST_ID_HEADER);

    expect(header).toMatch(/^[0-9a-f-]{36}$/);
    expect(await res.json()).toEqual({ requestId: header });
  });
});
