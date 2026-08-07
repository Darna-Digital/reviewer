/**
 * The channel between the API and the window's browser pane.
 *
 * The pane is a `<webview>` in the renderer, so the server cannot touch it
 * directly — an agent asking for the DOM has to be answered by the window. The
 * renderer holds a socket open at `/api/browser/bridge` for as long as the pane
 * is mounted; each HTTP request becomes one correlated command over it.
 *
 * Wire protocol — JSON text frames both directions:
 *   server → renderer: { id: string, op: BrowserOp, payload?: unknown }
 *   renderer → server: { id: string, ok: true, result: unknown }
 *                      { id: string, ok: false, error: string }
 *
 * Exactly one pane per window and one window per server, so a second connection
 * replaces the first rather than queueing: the newest window is the one the
 * human is looking at.
 */
import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";

export const BROWSER_BRIDGE_PATH = "/api/browser/bridge";

/** How long a command waits before the pane is treated as unreachable. */
const REPLY_TIMEOUT_MS = 15_000;

export type BrowserOp =
  | "state"
  | "navigate"
  | "snapshot"
  | "eval"
  | "screenshot"
  | "console";

export class BrowserBridgeError extends Error {}

interface Pending {
  readonly resolve: (value: unknown) => void;
  readonly reject: (cause: BrowserBridgeError) => void;
  readonly timer: NodeJS.Timeout;
}

export interface BrowserBridge {
  readonly connected: () => boolean;
  readonly request: (op: BrowserOp, payload?: unknown) => Promise<unknown>;
  readonly attach: (socket: WebSocket) => void;
}

export const makeBrowserBridge = (): BrowserBridge => {
  let socket: WebSocket | null = null;
  const pending = new Map<string, Pending>();

  const settleAll = (reason: string) => {
    for (const [, entry] of pending) {
      clearTimeout(entry.timer);
      entry.reject(new BrowserBridgeError(reason));
    }
    pending.clear();
  };

  const receive = (raw: string) => {
    let frame: { id?: string; ok?: boolean; result?: unknown; error?: string };
    try {
      frame = JSON.parse(raw) as typeof frame;
    } catch {
      return;
    }
    if (typeof frame.id !== "string") return;
    const entry = pending.get(frame.id);
    if (entry === undefined) return;
    pending.delete(frame.id);
    clearTimeout(entry.timer);
    if (frame.ok === true) entry.resolve(frame.result);
    else entry.reject(new BrowserBridgeError(frame.error ?? "browser failed"));
  };

  return {
    connected: () => socket !== null && socket.readyState === socket.OPEN,

    attach: (next) => {
      // A reload mints a new socket before the old one finishes closing; the
      // replaced pane can no longer answer, so fail its work rather than leak it.
      if (socket !== null && socket !== next) {
        settleAll("the browser pane was replaced");
        try {
          socket.close();
        } catch {
          // already closing
        }
      }
      socket = next;
      next.on("message", (data) => receive(data.toString()));
      next.on("close", () => {
        if (socket === next) socket = null;
        settleAll("the browser pane was closed");
      });
      next.on("error", () => {
        if (socket === next) socket = null;
        settleAll("the browser pane connection failed");
      });
    },

    request: (op, payload) =>
      new Promise((resolve, reject) => {
        const live = socket;
        if (live === null || live.readyState !== live.OPEN) {
          reject(
            new BrowserBridgeError(
              "no browser pane is open — open it from the globe in the window bar"
            )
          );
          return;
        }
        const id = randomUUID();
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new BrowserBridgeError(`the browser did not answer "${op}"`));
        }, REPLY_TIMEOUT_MS);
        pending.set(id, { resolve, reject, timer });
        try {
          live.send(JSON.stringify({ id, op, payload }));
        } catch (cause) {
          pending.delete(id);
          clearTimeout(timer);
          reject(
            new BrowserBridgeError(
              cause instanceof Error ? cause.message : String(cause)
            )
          );
        }
      }),
  };
};

/** The window's pane, shared by every request the way the PTY manager is. */
export const browserBridge = makeBrowserBridge();

export const startBrowserBridge = (ws: WebSocket): void =>
  browserBridge.attach(ws);
