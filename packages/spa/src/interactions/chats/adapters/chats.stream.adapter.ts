/**
 * useChatStream — the live view of one chat. Connects to the chat's event
 * WebSocket, adopts the `{snapshot}` the server replays on connect, then folds
 * `{event}` frames through the pure reducer. Reconnects with capped backoff
 * (the server replays a fresh snapshot each time, so no state is lost), except
 * after a server-reported `{error}` (unknown chat / no repo), which is
 * terminal for this id.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { chatStreamUrl } from "@/lib/api/client";
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

export function useChatStream(chatId: string | null): ChatStreamState {
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStreamStatus>("connecting");
  const queryClient = useQueryClient();
  // The sidebar list mirrors turn state — refresh it when a turn settles.
  const invalidateList = useRef(() => {
    void queryClient.invalidateQueries({ queryKey: ["get", "/api/chats"] });
  });

  useEffect(() => {
    setChat(null);
    setError(null);
    setStatus("connecting");
    if (chatId === null) return;

    let ws: WebSocket | null = null;
    let closed = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let lastFrameAt = Date.now();

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(chatStreamUrl(chatId));
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
          setChat(frame.snapshot);
        } else if (frame.event !== undefined) {
          const event = frame.event;
          setChat((prev) => applyChatEvent(prev, event));
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
    };
  }, [chatId]);

  return { chat, error, status };
}
