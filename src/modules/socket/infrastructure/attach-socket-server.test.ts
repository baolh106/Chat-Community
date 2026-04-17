import { createServer } from "node:http";
import type { AddressInfo } from "net";
import { io } from "socket.io-client";
import jwt from "jsonwebtoken";
import { privateKey } from "../../../config/env";
import { attachSocketServer } from "./attach-socket-server";

jest.setTimeout(10000);

describe("Socket.IO attachSocketServer", () => {
  let httpServer: ReturnType<typeof createServer>;
  let port: number;
  let closeServerIo: (() => Promise<void>) | null = null;
  const clients: Array<ReturnType<typeof io>> = [];

  beforeAll(async () => {
    httpServer = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address() as AddressInfo;
    port = address.port;
    const attached = await attachSocketServer(httpServer, {});
    closeServerIo = async () =>
      await new Promise<void>((resolve, reject) => {
        attached.io.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
  });

  afterEach(() => {
    clients.splice(0, clients.length).forEach((client) => {
      try {
        client.close();
      } catch {
        // ignore errors during cleanup
      }
    });
  });

  afterAll(async () => {
    if (closeServerIo) {
      await closeServerIo();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  it("should connect successfully with a valid JWT token", async () => {
    const accessToken = jwt.sign(
      { role: "user", userId: "user-test" },
      privateKey,
      {
        algorithm: "RS256",
        expiresIn: "1h",
      },
    );

    const client = io(`http://127.0.0.1:${port}`, {
      auth: { token: accessToken },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    clients.push(client);

    await new Promise<void>((resolve, reject) => {
      client.on("connect", () => resolve());
      client.on("connect_error", (err) => reject(err));
      client.on("error", (err) => reject(err));
    });

    expect(client.connected).toBe(true);
    client.close();
  });

  it("should reject connection when auth token is missing", async () => {
    const client = io(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    clients.push(client);

    await expect(
      new Promise<void>((resolve, reject) => {
        client.on("connect", () => reject(new Error("Expected connection to fail")));
        client.on("connect_error", () => resolve());
        client.on("error", (err) => reject(err));
      }),
    ).resolves.toBeUndefined();

    client.close();
  });

  it("should join user room when sending user:join", async () => {
    const accessToken = jwt.sign(
      { role: "user", userId: "user-join-test" },
      privateKey,
      {
        algorithm: "RS256",
        expiresIn: "1h",
      },
    );

    const client = io(`http://127.0.0.1:${port}`, {
      auth: { token: accessToken },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    clients.push(client);

    await new Promise<void>((resolve, reject) => {
      client.on("connect", () => {
        client.emit("user:join");
      });
      client.on("user:joined", () => resolve());
      client.on("user:join_denied", (err) => reject(new Error(JSON.stringify(err))));
      client.on("connect_error", (err) => reject(err));
      client.on("error", (err) => reject(err));
    });

    client.close();
  });

  it("should join admin room when sending admin:join", async () => {
    const accessToken = jwt.sign(
      { role: "admin" },
      privateKey,
      {
        algorithm: "RS256",
        expiresIn: "1h",
      },
    );

    const client = io(`http://127.0.0.1:${port}`, {
      auth: { token: accessToken },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    clients.push(client);

    await new Promise<void>((resolve, reject) => {
      client.on("connect", () => {
        client.emit("admin:join");
      });
      client.on("admin:joined", () => resolve());
      client.on("admin:join_denied", (err) => reject(new Error(JSON.stringify(err))));
      client.on("connect_error", (err) => reject(err));
      client.on("error", (err) => reject(err));
    });

    client.close();
  });
});
