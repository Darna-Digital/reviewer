/**
 * The cloud run stream, relayed: `GET /api/cloud/runs/:id/events?after=N`
 * opens the cloud's `GET /api/runs/:id/stream?after=N` in the user's name
 * and pipes the server-sent events straight through to the browser.
 *
 * Relayed rather than opened by the SPA itself for one reason: the bearer
 * token never leaves this process. It is read from the cloud connection row
 * as the request lands — synchronously, the way the chat runtime reads its
 * rows — so the stream needs nothing from the Effect runtime and is attached
 * beside it as a plain Node request listener (see `main.ts`).
 *
 * A client that goes away takes the upstream with it: the fetch is aborted
 * on `close`, so a tab left open and then shut does not hold a cloud stream
 * open for a run nobody is watching.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { readCloudConnection } from "./cloud.store.ts";

export const CLOUD_EVENTS_PREFIX = "/api/cloud/runs/";
const CLOUD_EVENTS_SUFFIX = "/events";

/** The run id a request path names, or null when it is not this route. */
export const cloudEventsRunId = (pathname: string): string | null => {
  if (
    !pathname.startsWith(CLOUD_EVENTS_PREFIX) ||
    !pathname.endsWith(CLOUD_EVENTS_SUFFIX)
  ) {
    return null;
  }
  const id = pathname.slice(
    CLOUD_EVENTS_PREFIX.length,
    pathname.length - CLOUD_EVENTS_SUFFIX.length
  );
  if (id.length === 0 || id.includes("/")) return null;
  try {
    return decodeURIComponent(id);
  } catch {
    return null;
  }
};

/** `after` as a sequence number; anything unreadable is the start. */
export const parseAfter = (value: string | null | undefined): number => {
  const after = Number(value ?? "0");
  return Number.isFinite(after) && after > 0 ? Math.floor(after) : 0;
};

/** The cloud's stream URL for a run, from a point in its log. */
export const cloudStreamUrl = (
  serverUrl: string,
  runId: string,
  after: number
): string =>
  `${serverUrl.replace(/\/+$/, "")}/api/runs/${encodeURIComponent(runId)}/stream?after=${after}`;

/** What the upstream request carries. */
export const cloudStreamHeaders = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`,
  accept: "text/event-stream",
});

/** What the browser is answered with, whatever the upstream said. */
export const SSE_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
  "access-control-allow-origin": "*",
};

const answerJson = (
  res: ServerResponse,
  status: number,
  body: { readonly _tag: string; readonly reason: string }
): void => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(body));
};

/**
 * Handle the request if it is the events route. Returns `true` when it was
 * taken, so the caller keeps it from the Effect handler; `false` otherwise.
 */
export const handleCloudEvents = (
  req: IncomingMessage,
  res: ServerResponse
): boolean => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const runId = cloudEventsRunId(url.pathname);
  if (runId === null) return false;
  if (req.method !== "GET") {
    answerJson(res, 405, {
      _tag: "MethodNotAllowed",
      reason: "the run stream is read with GET",
    });
    return true;
  }

  const connection = readCloudConnection();
  if (connection === null || connection.token === null) {
    answerJson(res, 409, {
      _tag: "CloudNotConnected",
      reason:
        "reviewer is not connected to reviewer cloud — connect in Settings",
    });
    return true;
  }

  const after = parseAfter(url.searchParams.get("after"));
  const controller = new AbortController();
  // `close` fires whether the browser navigated away, the tab was shut, or the
  // response ended on its own — in every case the upstream is done with.
  res.on("close", () => controller.abort());

  void relay(
    cloudStreamUrl(connection.serverUrl, runId, after),
    cloudStreamHeaders(connection.token),
    res,
    controller
  );
  return true;
};

const relay = async (
  url: string,
  headers: Record<string, string>,
  res: ServerResponse,
  controller: AbortController
): Promise<void> => {
  let upstream: globalThis.Response;
  try {
    upstream = await fetch(url, { headers, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) return;
    answerJson(res, 502, {
      _tag: "CloudApiError",
      reason: `could not reach reviewer cloud: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    return;
  }
  if (!upstream.ok || upstream.body === null) {
    const body = await upstream.text().catch(() => "");
    let reason = `reviewer cloud answered ${upstream.status}`;
    try {
      const parsed = JSON.parse(body) as { reason?: unknown };
      if (typeof parsed.reason === "string") reason = parsed.reason;
    } catch {
      /* not JSON — keep the status line */
    }
    answerJson(res, upstream.status === 404 ? 404 : 502, {
      _tag: upstream.status === 404 ? "NotFound" : "CloudApiError",
      reason,
    });
    return;
  }

  res.writeHead(200, SSE_RESPONSE_HEADERS);
  res.flushHeaders();
  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(value)) {
        await new Promise<void>((resolve) => res.once("drain", resolve));
      }
    }
  } catch {
    // The upstream dropped or the client left: either way the stream is over,
    // and the browser's EventSource reconnects from the last seq it saw.
  } finally {
    res.end();
  }
};
