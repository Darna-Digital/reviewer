/**
 * Keeps the server to this machine's own clients. The API can spawn shells and
 * agent CLIs (`/api/threads/pty`), so anything that reaches it can run commands
 * as the user — and it carries no credentials, so reachability is the only
 * boundary there is.
 *
 * Three layers hold that boundary:
 *   - it listens on loopback only (`LOOPBACK_HOST`), so the network can't
 *     connect at all;
 *   - a request whose `Host` isn't a loopback name is refused, which defeats
 *     DNS rebinding (a web page whose own hostname has been re-pointed at
 *     127.0.0.1 still sends that hostname);
 *   - a request carrying an `Origin` from anywhere but the app is refused, so
 *     a web page open in a browser can neither open a terminal WebSocket (which
 *     CORS never covers) nor fire a "simple" cross-site POST that skips the
 *     preflight.
 *
 * Clients outside a browser — the Mac app's native calls, the TUI, an agent
 * CLI curling `REVIEWER_API` — send no `Origin` and pass.
 */
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  Server,
  ServerResponse,
} from "node:http";
import type { Duplex } from "node:stream";

export const LOOPBACK_HOST = "127.0.0.1";

/** The packaged Mac app serves the SPA from its custom scheme. */
const APP_ORIGIN = "reviewer://app";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

const hostnameOf = (authority: string): string | undefined => {
  try {
    return new URL(`http://${authority}`).hostname;
  } catch {
    return undefined;
  }
};

const isLoopbackAuthority = (authority: string | undefined): boolean => {
  if (authority === undefined) return false;
  const hostname = hostnameOf(authority);
  return hostname !== undefined && LOOPBACK_HOSTNAMES.has(hostname);
};

/**
 * Origins allowed to call the API from a web page: the packaged app, and a page
 * served from this machine — the Vite dev server the debug app and the browser
 * load the SPA from.
 */
export const isAllowedOrigin = (origin: string): boolean => {
  if (origin === APP_ORIGIN) return true;
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      LOOPBACK_HOSTNAMES.has(url.hostname)
    );
  } catch {
    return false;
  }
};

export const isLocalRequest = (headers: IncomingHttpHeaders): boolean => {
  const origin = headers.origin;
  return (
    isLoopbackAuthority(headers.host) &&
    (origin === undefined || isAllowedOrigin(origin))
  );
};

const refuseRequest = (response: ServerResponse): void => {
  response.writeHead(403, { "Content-Type": "text/plain" });
  response.end("Forbidden\n");
};

const refuseUpgrade = (socket: Duplex): void => {
  socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
};

/**
 * Refuse every request and WebSocket upgrade that doesn't pass
 * `isLocalRequest`, before any listener sees it. Wrapping `emit` catches the
 * events at their source, so the Effect HttpApi, the PTY dispatcher and any
 * listener added later are all behind it, whatever order they registered in.
 */
export const guardLocalRequests = (server: Server): void => {
  const emit = server.emit.bind(server) as (
    event: string,
    ...args: unknown[]
  ) => boolean;
  server.emit = ((event: string, ...args: unknown[]) => {
    if (event === "request" || event === "checkContinue") {
      const [request, response] = args as [IncomingMessage, ServerResponse];
      if (!isLocalRequest(request.headers)) {
        refuseRequest(response);
        return true;
      }
    } else if (event === "upgrade") {
      const [request, socket] = args as [IncomingMessage, Duplex];
      if (!isLocalRequest(request.headers)) {
        refuseUpgrade(socket);
        return true;
      }
    }
    return emit(event, ...args);
  }) as Server["emit"];
};
