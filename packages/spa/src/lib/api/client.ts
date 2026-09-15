import createFetchClient from "openapi-fetch";
import createQueryClient from "openapi-react-query";
import { desktopApiBaseUrl } from "@/lib/desktop";
import type { paths } from "./schema";

/**
 * Browser/dev stays same-origin through Vite's proxy. Packaged Electron serves
 * the renderer over `reviewer://`, so the preload bridge supplies the local API
 * server origin — including inside a preview frame, which has no preload of its
 * own and takes the bridge from the window it hangs in (see `lib/desktop`).
 */
export const fetchClient = createFetchClient<paths>({
  baseUrl: desktopApiBaseUrl ?? "",
});

export const api = createQueryClient(fetchClient);

/**
 * The PTY WebSocket URL for a live terminal. Shares the API origin/port (the
 * server hosts the WS on the same port as the HttpApi), so it follows the same
 * routing: same-origin behind Vite's `/api` ws proxy in the browser, and the
 * desktop bridge's API origin in the packaged app.
 */
export const ptySocketUrl = (params: {
  /** Thread id — keys the persistent server-side PTY session for reconnects. */
  id: string;
  agent: string;
  cols: number;
  rows: number;
  /** Terminal theme, so the PTY can advertise its background brightness
   * (COLORFGBG) and agent CLIs pick readable colours. Only used on a fresh
   * spawn. */
  theme: "light" | "dark";
}): string => {
  const origin =
    desktopApiBaseUrl ??
    (typeof window === "undefined"
      ? "http://localhost"
      : window.location.origin);
  const url = new URL("/api/threads/pty", origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("id", params.id);
  url.searchParams.set("agent", params.agent);
  url.searchParams.set("cols", String(params.cols));
  url.searchParams.set("rows", String(params.rows));
  url.searchParams.set("theme", params.theme);
  return url.toString();
};

/**
 * The event-stream WebSocket URL for an agent chat. Same origin/port and
 * `/api` ws routing as {@link ptySocketUrl}; the server replays the chat
 * snapshot on connect and pushes turn events (deltas/activities) as they
 * stream. Read-only — mutations go through the REST API.
 */
export const chatStreamUrl = (chatId: string): string => {
  const origin =
    desktopApiBaseUrl ??
    (typeof window === "undefined"
      ? "http://localhost"
      : window.location.origin);
  const url = new URL("/api/chats/stream", origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("chat", chatId);
  return url.toString();
};

/**
 * The command socket for the window's browser pane. Same origin/port and `/api`
 * ws routing as {@link ptySocketUrl}; the pane holds it open while mounted and
 * answers the commands agents send through the browser API.
 */
export const browserBridgeUrl = (): string => {
  const origin =
    desktopApiBaseUrl ??
    (typeof window === "undefined"
      ? "http://localhost"
      : window.location.origin);
  const url = new URL("/api/browser/bridge", origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

/**
 * The PTY WebSocket URL for a Local Dev command's running process. Same
 * origin/port and `/api` ws routing as {@link ptySocketUrl}; the server attaches
 * the socket to the process the DevProcessManager already owns for `command`.
 */
export const devPtySocketUrl = (params: {
  /** Dev command id — the DevProcessManager keys its running process by it. */
  command: string;
  cols: number;
  rows: number;
}): string => {
  const origin =
    desktopApiBaseUrl ??
    (typeof window === "undefined"
      ? "http://localhost"
      : window.location.origin);
  const url = new URL("/api/local-dev/pty", origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("command", params.command);
  url.searchParams.set("cols", String(params.cols));
  url.searchParams.set("rows", String(params.rows));
  return url.toString();
};

/**
 * The server-sent event stream of a cloud run, relayed by the local server
 * (which holds the cloud token) from the last sequence number the client saw.
 * Plain HTTP rather than a WebSocket, so it follows the same `/api` routing as
 * every REST call: same-origin behind Vite's proxy, the desktop bridge's API
 * origin in the packaged app.
 */
export const cloudRunEventsUrl = (runId: string, after: number): string => {
  const origin =
    desktopApiBaseUrl ??
    (typeof window === "undefined"
      ? "http://localhost"
      : window.location.origin);
  const url = new URL(
    `/api/cloud/runs/${encodeURIComponent(runId)}/events`,
    origin
  );
  url.searchParams.set("after", String(after));
  return url.toString();
};
