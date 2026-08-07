import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { makeBrowserBridge } from "./browser-bridge.ts";

/** A socket that records what was sent and lets a test play the pane's replies. */
const fakeSocket = () => {
  const handlers = new Map<string, (data: unknown) => void>();
  const sent: Array<{ id: string; op: string; payload?: unknown }> = [];
  let closed = false;
  const socket = {
    OPEN: 1,
    get readyState() {
      return closed ? 3 : 1;
    },
    on(event: string, handler: (data: unknown) => void) {
      handlers.set(event, handler);
      return socket;
    },
    send(raw: string) {
      sent.push(JSON.parse(raw) as (typeof sent)[number]);
    },
    close() {
      closed = true;
      handlers.get("close")?.(undefined);
    },
  };
  return {
    socket: socket as unknown as WebSocket,
    sent,
    reply: (frame: unknown) => handlers.get("message")?.(JSON.stringify(frame)),
    drop: () => socket.close(),
    isClosed: () => closed,
  };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("browser bridge", () => {
  it("refuses commands until a pane connects", async () => {
    const bridge = makeBrowserBridge();
    expect(bridge.connected()).toBe(false);
    await expect(bridge.request("state")).rejects.toThrow(/no browser pane/);
  });

  it("answers a command with the reply carrying its id", async () => {
    const bridge = makeBrowserBridge();
    const pane = fakeSocket();
    bridge.attach(pane.socket);
    expect(bridge.connected()).toBe(true);

    const pending = bridge.request("snapshot", { selector: "#a" });
    expect(pane.sent).toHaveLength(1);
    expect(pane.sent[0]).toMatchObject({
      op: "snapshot",
      payload: { selector: "#a" },
    });

    pane.reply({ id: pane.sent[0].id, ok: true, result: { html: "<b/>" } });
    await expect(pending).resolves.toEqual({ html: "<b/>" });
  });

  it("keeps concurrent commands apart", async () => {
    const bridge = makeBrowserBridge();
    const pane = fakeSocket();
    bridge.attach(pane.socket);

    const first = bridge.request("state");
    const second = bridge.request("screenshot");
    // Answered out of order — each still settles with its own result.
    pane.reply({ id: pane.sent[1].id, ok: true, result: "shot" });
    pane.reply({ id: pane.sent[0].id, ok: true, result: "state" });

    await expect(first).resolves.toBe("state");
    await expect(second).resolves.toBe("shot");
  });

  it("surfaces a failure the pane reports", async () => {
    const bridge = makeBrowserBridge();
    const pane = fakeSocket();
    bridge.attach(pane.socket);

    const pending = bridge.request("snapshot");
    pane.reply({
      id: pane.sent[0].id,
      ok: false,
      error: 'nothing matches "#x"',
    });
    await expect(pending).rejects.toThrow('nothing matches "#x"');
  });

  it("gives up on a pane that never answers", async () => {
    const bridge = makeBrowserBridge();
    const pane = fakeSocket();
    bridge.attach(pane.socket);

    const pending = bridge.request("eval");
    const settled = expect(pending).rejects.toThrow(/did not answer "eval"/);
    await vi.advanceTimersByTimeAsync(20_000);
    await settled;
  });

  it("fails everything in flight when the pane closes", async () => {
    const bridge = makeBrowserBridge();
    const pane = fakeSocket();
    bridge.attach(pane.socket);

    const pending = bridge.request("state");
    pane.drop();
    await expect(pending).rejects.toThrow(/closed/);
    expect(bridge.connected()).toBe(false);
  });

  it("replaces a pane rather than serving two", async () => {
    const bridge = makeBrowserBridge();
    const first = fakeSocket();
    const second = fakeSocket();
    bridge.attach(first.socket);

    const pending = bridge.request("state");
    bridge.attach(second.socket);
    await expect(pending).rejects.toThrow(/replaced/);
    expect(first.isClosed()).toBe(true);

    // The newest pane is the one commands now reach.
    const next = bridge.request("state");
    expect(second.sent).toHaveLength(1);
    second.reply({ id: second.sent[0].id, ok: true, result: "ok" });
    await expect(next).resolves.toBe("ok");
  });

  it("ignores a reply for a command it is not waiting on", async () => {
    const bridge = makeBrowserBridge();
    const pane = fakeSocket();
    bridge.attach(pane.socket);

    expect(() =>
      pane.reply({ id: "nobody", ok: true, result: 1 })
    ).not.toThrow();
    expect(() => pane.reply("not json at all")).not.toThrow();
  });
});
