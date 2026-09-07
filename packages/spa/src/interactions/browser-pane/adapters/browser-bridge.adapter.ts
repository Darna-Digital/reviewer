/**
 * The renderer's half of the browser bridge (see
 * `embedded-server/src/layers/browser/browser-bridge.ts`).
 *
 * The pane holds this socket open for as long as it is mounted; each frame that
 * arrives is one agent's HTTP request, executed against the live `<webview>` and
 * answered. Everything the guest is asked runs through `executeJavaScript`,
 * which is the only way into an out-of-process page that runs no preload.
 */
import type { BrowserState, ConsoleMessage } from "@reviewer/core/browser";
import { browserBridgeUrl } from "@/lib/api/client";
import {
  browserPaneSnapshot,
  consoleMessages,
  paneWebview,
  updateBrowserPane,
} from "./browser-pane.store";
import { normalizeUrl } from "../functions/browser-pane.functions";
import type { WebviewElement } from "../interfaces/browser-pane.interfaces";

const RECONNECT_MS = 2_000;

/**
 * Read the page inside the guest. Returned as one object so the whole snapshot
 * is consistent — separate round trips could straddle a re-render.
 */
const snapshotScript = (selector: string | null): string => `
(() => {
  const selector = ${JSON.stringify(selector)};
  const node = selector === null
    ? document.documentElement
    : document.querySelector(selector);
  if (node === null) return null;
  return {
    url: location.href,
    title: document.title,
    selector: selector === null ? ":root" : selector,
    html: node.outerHTML,
    text: (node.textContent || "").replace(/\\s+/g, " ").trim(),
  };
})()
`;

const requireGuest = (): WebviewElement => {
  const guest = paneWebview();
  if (guest === null) throw new Error("the browser pane has no page open");
  return guest;
};

const paneState = (): BrowserState => {
  const pane = browserPaneSnapshot();
  return {
    connected: true,
    url: pane.url,
    title: pane.title,
    loading: pane.loading,
  };
};

const run = async (op: string, payload: unknown): Promise<unknown> => {
  switch (op) {
    case "state":
      return paneState();

    case "navigate": {
      const asked = (payload as { url?: string } | null)?.url ?? "";
      const url = normalizeUrl(asked);
      if (url === null) throw new Error(`"${asked}" is not a web address`);
      updateBrowserPane({ url });
      // The tag may not exist yet when the pane was blank, so drive the store
      // and let React mount it rather than reaching for a guest that is absent.
      const guest = paneWebview();
      if (guest !== null && guest.getURL() !== url) await guest.loadURL(url);
      return paneState();
    }

    case "snapshot": {
      const selector =
        (payload as { selector?: string | null } | null)?.selector ?? null;
      const result = await requireGuest().executeJavaScript(
        snapshotScript(selector)
      );
      if (result === null) throw new Error(`nothing matches "${selector}"`);
      return result;
    }

    case "eval": {
      const script = (payload as { script?: string } | null)?.script ?? "";
      const value = await requireGuest().executeJavaScript(script);
      return { json: JSON.stringify(value) ?? "undefined" };
    }

    case "console":
      return consoleMessages() satisfies ReadonlyArray<ConsoleMessage>;

    case "screenshot": {
      const image = await requireGuest().capturePage();
      return { dataUrl: image.toDataURL() };
    }

    default:
      throw new Error(`unknown browser command "${op}"`);
  }
};

/**
 * Connect, and keep reconnecting until told to stop. Returns the teardown the
 * pane calls on unmount — which must also stop the retry, or a closed pane
 * would go on reopening the socket for the life of the window.
 */
export function connectBrowserBridge(): () => void {
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const open = () => {
    if (stopped) return;
    const next = new WebSocket(browserBridgeUrl());
    socket = next;

    next.onmessage = (event) => {
      let frame: { id?: string; op?: string; payload?: unknown };
      try {
        frame = JSON.parse(String(event.data)) as typeof frame;
      } catch {
        return;
      }
      const { id, op } = frame;
      if (typeof id !== "string" || typeof op !== "string") return;
      run(op, frame.payload ?? null).then(
        (result) => next.send(JSON.stringify({ id, ok: true, result })),
        (cause: unknown) =>
          next.send(
            JSON.stringify({
              id,
              ok: false,
              error: cause instanceof Error ? cause.message : String(cause),
            })
          )
      );
    };

    next.onclose = () => {
      if (stopped || socket !== next) return;
      retry = setTimeout(open, RECONNECT_MS);
    };
  };

  open();

  return () => {
    stopped = true;
    if (retry !== null) clearTimeout(retry);
    socket?.close();
  };
}
