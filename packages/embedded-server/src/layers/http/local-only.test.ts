import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import {
  guardLocalRequests,
  isAllowedOrigin,
  isLocalRequest,
  LOOPBACK_HOST,
} from "./local-only.ts";

describe("isAllowedOrigin", () => {
  it.each([
    "reviewer://app",
    "http://localhost:41812",
    "http://127.0.0.1:41812",
    "http://[::1]:41812",
    "https://localhost",
  ])("allows %s", (origin) => {
    expect(isAllowedOrigin(origin)).toBe(true);
  });

  it.each([
    "https://evil.example",
    "http://localhost.evil.example",
    "http://192.168.1.20:41812",
    "reviewer://other",
    "file://",
    "null",
    "",
  ])("refuses %s", (origin) => {
    expect(isAllowedOrigin(origin)).toBe(false);
  });
});

describe("isLocalRequest", () => {
  it("allows a loopback host with no origin", () => {
    expect(isLocalRequest({ host: "127.0.0.1:41811" })).toBe(true);
    expect(isLocalRequest({ host: "localhost:41811" })).toBe(true);
  });

  it("refuses a rebound or LAN host", () => {
    expect(isLocalRequest({ host: "evil.example:41811" })).toBe(false);
    expect(isLocalRequest({ host: "192.168.1.20:41811" })).toBe(false);
    expect(isLocalRequest({})).toBe(false);
  });

  it("refuses a foreign origin on a loopback host", () => {
    expect(
      isLocalRequest({
        host: "127.0.0.1:41811",
        origin: "https://evil.example",
      })
    ).toBe(false);
  });
});

describe("guardLocalRequests", () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((_request, response) => response.end("ok"));
    guardLocalRequests(server);
    const wss = new WebSocketServer({ noServer: true });
    server.on("upgrade", (incoming, socket, head) =>
      wss.handleUpgrade(incoming, socket, head, (ws) => ws.close())
    );
    await new Promise<void>((resolve) =>
      server.listen(0, LOOPBACK_HOST, resolve)
    );
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const statusOf = (headers: Record<string, string>): Promise<number> =>
    new Promise((resolve, reject) => {
      request(
        { host: LOOPBACK_HOST, port, method: "POST", headers },
        (response) => {
          response.resume();
          resolve(response.statusCode ?? 0);
        }
      )
        .on("error", reject)
        .end();
    });

  const upgradeOutcome = (origin: string): Promise<"open" | number> =>
    new Promise((resolve) => {
      const ws = new WebSocket(
        `ws://${LOOPBACK_HOST}:${port}/api/threads/pty`,
        { origin }
      );
      ws.on("open", () => {
        ws.terminate();
        resolve("open");
      });
      ws.on("unexpected-response", (_request, response) =>
        resolve(response.statusCode ?? 0)
      );
      ws.on("error", () => undefined);
    });

  it("serves a native client", async () => {
    expect(await statusOf({ host: `127.0.0.1:${port}` })).toBe(200);
  });

  it("serves the app's own origin", async () => {
    expect(
      await statusOf({ host: `127.0.0.1:${port}`, origin: "reviewer://app" })
    ).toBe(200);
  });

  it("refuses a cross-site request", async () => {
    expect(
      await statusOf({
        host: `127.0.0.1:${port}`,
        origin: "https://evil.example",
      })
    ).toBe(403);
  });

  it("refuses a DNS-rebound request", async () => {
    expect(await statusOf({ host: `evil.example:${port}` })).toBe(403);
  });

  it("opens a terminal socket for the app", async () => {
    expect(await upgradeOutcome("reviewer://app")).toBe("open");
  });

  it("refuses a terminal socket from a web page", async () => {
    expect(await upgradeOutcome("https://evil.example")).toBe(403);
  });
});
