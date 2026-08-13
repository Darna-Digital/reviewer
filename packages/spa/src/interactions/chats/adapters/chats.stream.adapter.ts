/**
 * useChatStream — the live view of one chat. Connects to the chat's event
 * WebSocket, adopts the `{snapshot}` the server replays on connect, then folds
 * `{event}` frames through the pure reducer. Reconnects with capped backoff
 * (the server replays a fresh snapshot each time, so no state is lost), except
 * after a server-reported `{error}` (unknown chat / no repo), which is
 * terminal for this id.
 *
 * A conversation you have already opened (or hovered, so the sidebar's preview
 * fetched it) is in the query cache, so the socket starts from it rather than
 * from nothing: switching back to a session shows it at once and the snapshot,
 * when it lands a moment later, replaces it in place instead of a loader. A
 * session with nothing cached falls back to the REST read — the same request
 * the preview makes, deduplicated — so whichever of the two arrives first is
 * what fills the view.
 */
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { chatStreamUrl } from "@/lib/api/client";
import { chatQueryOptions } from "@/lib/queries";
import type { Chat } from "@byconvo/core/chats";
import type { ChatWireEvent } from "../interfaces/chats.interfaces";
import { applyChatEvent } from "../functions/chats.reducer";

/** "live" once a socket is open; "reconnecting" between a drop and the retry
 * that succeeds — the difference between a quiet agent and a broken pipe. */
export type ChatStreamStatus = "connecting" | "live" | "reconnecting";

interface ChatStreamState {
  readonly chat: Chat | null;
  readonly error: string | null;
  readonly status: ChatStreamStatus;
}

/** How long without any frame — including the server's `{ping}` — before the
 * socket is presumed dead. Comfortably over two server heartbeats. */
const STALE_AFTER_MS = 45_000;
const WATCHDOG_MS = 5_000;

const cachedChat = (client: QueryClient, id: string | null): Chat | null =>
  id === null
    ? null
    : (client.getQueryData<Chat>(chatQueryOptions(id).queryKey) ?? null);

export function useChatStream(chatId: string | null): ChatStreamState {
  const queryClient = useQueryClient();
  const [chat, setChat] = useState<Chat | null>(() =>
    cachedChat(queryClient, chatId)
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStreamStatus>("connecting");
  // The sidebar list mirrors turn state — refresh it when a turn settles.
  const invalidateList = useRef(() => {
    void queryClient.invalidateQueries({ queryKey: ["get", "/api/chats"] });
  });

  useEffect(() => {
    const id = chatId;
    setChat(cachedChat(queryClient, id));
    setError(null);
    setStatus("connecting");
    if (id === null) return;

    // What the next visit starts from. Held here and written on the way out
    // rather than on every delta, so a streaming reply doesn't rewrite the
    // cache a hundred times to save one paint later.
    let latest: Chat | null = cachedChat(queryClient, id);
    const remember = (next: Chat | null): Chat | null => {
      latest = next;
      return next;
    };

    let ws: WebSocket | null = null;
    let closed = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let lastFrameAt = Date.now();

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(chatStreamUrl(id));
      ws.onopen = () => {
        attempts = 0;
        lastFrameAt = Date.now();
        setStatus("live");
      };
      ws.onmessage = (raw: MessageEvent<string>) => {
        lastFrameAt = Date.now();
        let frame: {
          snapshot?: Chat;
          event?: ChatWireEvent;
          error?: string;
        };
        try {
          frame = JSON.parse(raw.data) as typeof frame;
        } catch {
          return;
        }
        if (frame.snapshot !== undefined) {
          setChat(remember(frame.snapshot));
        } else if (frame.event !== undefined) {
          const event = frame.event;
          setChat((prev) => remember(applyChatEvent(prev, event)));
          if (event.type === "turn-completed" || event.type === "turn-started")
            invalidateList.current();
        } else if (frame.error !== undefined) {
          // Terminal: the chat doesn't exist here — reconnecting won't help.
          closed = true;
          setError(frame.error);
        }
      };
      ws.onclose = () => {
        if (closed) return;
        setStatus("reconnecting");
        attempts += 1;
        retryTimer = setTimeout(connect, Math.min(8000, 500 * 2 ** attempts));
      };
    };
    connect();

    // A sleeping laptop or a dropped tunnel leaves a socket that is open as far
    // as the browser knows but will never deliver another frame, and `onclose`
    // never fires — so the reconnect above never runs and the turn appears to
    // hang. The server's heartbeat means silence this long is not just a quiet
    // agent; closing here is what puts us back on the reconnect path.
    const watchdog = setInterval(() => {
      if (closed || ws === null) return;
      if (Date.now() - lastFrameAt < STALE_AFTER_MS) return;
      lastFrameAt = Date.now();
      setStatus("reconnecting");
      ws.close();
    }, WATCHDOG_MS);

    return () => {
      closed = true;
      clearInterval(watchdog);
      if (retryTimer !== null) clearTimeout(retryTimer);
      ws?.close();
      if (latest !== null) {
        queryClient.setQueryData(chatQueryOptions(id).queryKey, latest);
      }
    };
  }, [chatId, queryClient]);

  const rest = useQuery({
    ...chatQueryOptions(chatId ?? ""),
    enabled: chatId !== null && chat === null && error === null,
    retry: false,
  });

  return { chat: chat ?? rest.data ?? null, error, status };
}
