/**
 * Marks the open session as looked at — the write behind both of the row's
 * dots going quiet once you are in the conversation.
 *
 * Sent at each of the session's resting points (see `chatSeenMark`), never
 * during a stream, and never twice for the same one. The cached summary is
 * patched rather than refetched: the row is beside the conversation the reader
 * just opened, so it should settle then and not a network round-trip later.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { fetchClient } from "@/lib/api/client";
import type { Chat } from "@byconvo/core/chats";
import { chatSeenMark } from "../functions/chat-seen.functions";
import { patchChatSummary } from "./chats.cache";

export function useMarkChatSeen(chat: Chat | null): void {
  const queryClient = useQueryClient();
  const chatId = chat?.id ?? null;
  const mark = chatSeenMark(chat);
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (chatId === null || mark === null || sent.current === mark) return;
    sent.current = mark;
    patchChatSummary(queryClient, chatId, { seenAt: new Date().toISOString() });
    // Nothing waits on the answer: the row has already settled, and a session
    // deleted from under us is the one failure here, which the view reports on
    // its own account.
    void fetchClient.POST("/api/chats/{id}/seen", {
      params: { path: { id: chatId } },
    });
  }, [chatId, mark, queryClient]);
}
