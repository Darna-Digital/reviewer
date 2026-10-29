import createFetchClient from "openapi-fetch";
import createQueryClient from "openapi-react-query";
import { desktopApiBaseUrl } from "@/lib/desktop";
import { REPO_HEADER, REPO_SEARCH_PARAM, scopedRepo } from "@/lib/repo-scope";
import type { paths } from "./schema";

/**
 * Browser/dev stays same-origin through Vite's proxy. The macOS shell serves
 * the app over `reviewer://`, so its bridge supplies the local API server
 * origin — including inside a preview frame, which has no bridge of its own
 * and takes the one from the window it hangs in (see `lib/desktop`).
 */
export const fetchClient = createFetchClient<paths>({
  baseUrl: desktopApiBaseUrl ?? "",
});

// Every request names the repository the page is about (see `lib/repo-scope`);
// the root is read as the request leaves, so one already in flight when the
// page moves to another repository still answers for the one it asked about.
fetchClient.use({
  onRequest: ({ request }) => {
    const repo = scopedRepo();
    if (repo !== undefined) {
      request.headers.set(REPO_HEADER, encodeURIComponent(repo));
    }
    return request;
  },
});

export const api = createQueryClient(fetchClient);

/** A socket URL on the API's origin, naming the page's repository. */
const socketUrl = (path: string): URL => {
  const origin =
    desktopApiBaseUrl ??
    (typeof window === "undefined"
      ? "http://localhost"
      : window.location.origin);
  const url = new URL(path, origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const repo = scopedRepo();
  if (repo !== undefined) url.searchParams.set(REPO_SEARCH_PARAM, repo);
  return url;
};

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
  const url = socketUrl("/api/threads/pty");
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
  const url = socketUrl("/api/chats/stream");
  url.searchParams.set("chat", chatId);
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
  const url = socketUrl("/api/local-dev/pty");
  url.searchParams.set("command", params.command);
  url.searchParams.set("cols", String(params.cols));
  url.searchParams.set("rows", String(params.rows));
  return url.toString();
};
