import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchClient } from "@/lib/api/client";
import { chatQueryOptions } from "@/lib/queries";
import type { Chat, ChatSummary } from "@reviewer/core/chats";
import { invalidateChatList, prependChatSummary } from "./chats.cache";
import { createChatsFunctions } from "../functions/chats.functions";
import type {
  ChatImage,
  ChatPlace,
  ChatSettings,
  ChatsFunctions,
} from "../interfaces/chats.interfaces";

const fail = (error: unknown, fallback: string): never => {
  throw new Error((error as { reason?: string })?.reason ?? fallback);
};

export interface RemoveFailure {
  readonly id: string;
  readonly message: string;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : "delete failed";

/** Wires the real chat API mutations + cache invalidation into the logic. */
export function useChatsActions() {
  const queryClient = useQueryClient();

  const fns: ChatsFunctions = useMemo(
    () =>
      createChatsFunctions({
        data: {},
        sideEffects: {
          create: async (input) => {
            const { data, error } = await fetchClient.POST("/api/chats", {
              body: input,
            });
            if (error) return fail(error, "failed to create chat");
            return data;
          },
          send: async (id, text, images) => {
            const { data, error } = await fetchClient.POST(
              "/api/chats/{id}/messages",
              { params: { path: { id } }, body: { text, images: [...images] } }
            );
            if (error) return fail(error, "failed to send message");
            return data;
          },
          update: async (id, input) => {
            const { data, error } = await fetchClient.PATCH("/api/chats/{id}", {
              params: { path: { id } },
              body: input,
            });
            if (error) return fail(error, "failed to update chat");
            return data;
          },
          stop: async (id) => {
            await fetchClient.POST("/api/chats/{id}/stop", {
              params: { path: { id } },
            });
          },
          remove: async (id) => {
            const { error } = await fetchClient.DELETE("/api/chats/{id}", {
              params: { path: { id } },
            });
            if (error) fail(error, "failed to delete chat");
          },
        },
      }),
    []
  );

  const invalidate = () => invalidateChatList(queryClient);

  // Optimistically put a freshly-started chat at the top of the list cache so
  // the sidebar shows it before the refetch lands (see threads.hook.adapter).
  const prependChat = (chat: Chat) => {
    const summary: ChatSummary = {
      id: chat.id,
      origin: chat.origin,
      title: chat.title,
      provider: chat.provider,
      model: chat.model,
      branch: chat.branch,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      seenAt: chat.seenAt,
      messageCount: chat.messages.length,
      lastMessage: chat.messages.at(-1)?.text.slice(0, 120) ?? null,
      turnState: chat.latestTurn?.state ?? null,
    };
    prependChatSummary(queryClient, summary);
  };

  return {
    start: async (
      settings: ChatSettings,
      place: ChatPlace,
      text: string,
      images: ReadonlyArray<ChatImage> = []
    ) => {
      const started = await fns.start(settings, place, text, images);
      if (started !== null) {
        prependChat(started);
        invalidate();
      }
      return started;
    },
    startWithTitle: async (
      settings: ChatSettings,
      place: ChatPlace,
      title: string,
      text: string,
      images: ReadonlyArray<ChatImage> = []
    ) => {
      const started = await fns.startWithTitle(
        settings,
        place,
        title,
        text,
        images
      );
      if (started !== null) {
        prependChat(started);
        invalidate();
      }
      return started;
    },
    send: async (
      id: string,
      text: string,
      images: ReadonlyArray<ChatImage> = []
    ) => {
      const sent = await fns.send(id, text, images);
      if (sent !== null) invalidate();
      return sent;
    },
    updateSettings: async (id: string, patch: Partial<ChatSettings>) => {
      const updated = await fns.updateSettings(id, patch);
      invalidate();
      return updated;
    },
    rename: async (id: string, title: string) => {
      const updated = await fns.rename(id, title);
      invalidate();
      return updated;
    },
    stop: async (id: string) => {
      await fns.stop(id);
      invalidate();
    },
    /**
     * Deletes a whole selection as one piece of work: the list is invalidated
     * once at the end rather than once per row, so sweeping twenty sessions
     * away refetches the list once. What would not go comes back — the
     * failures are all a caller has anything to say about, and the rest are
     * already gone.
     */
    removeMany: async (
      ids: ReadonlyArray<string>
    ): Promise<ReadonlyArray<RemoveFailure>> => {
      const outcomes = await Promise.allSettled(
        ids.map((id) => fns.remove(id))
      );
      const failed: RemoveFailure[] = [];
      ids.forEach((id, i) => {
        const outcome = outcomes[i];
        if (outcome?.status === "rejected") {
          failed.push({ id, message: messageOf(outcome.reason) });
          return;
        }
        // Drop the conversation the live view seeds itself from, so a deleted
        // session can't be reopened from cache.
        queryClient.removeQueries({ queryKey: chatQueryOptions(id).queryKey });
      });
      invalidate();
      return failed;
    },
  };
}
