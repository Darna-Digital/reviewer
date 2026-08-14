import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchClient } from "@/lib/api/client";
import { chatQueryOptions } from "@/lib/queries";
import type { Chat, ChatPage, ChatSummary } from "@byconvo/core/chats";
import { createChatsFunctions } from "../functions/chats.functions";
import type {
  ChatImage,
  ChatSettings,
  ChatsFunctions,
} from "../interfaces/chats.interfaces";

const fail = (error: unknown, fallback: string): never => {
  throw new Error((error as { reason?: string })?.reason ?? fallback);
};

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
            await fetchClient.DELETE("/api/chats/{id}", {
              params: { path: { id } },
            });
          },
        },
      }),
    []
  );

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["get", "/api/chats"] });
  };

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
      messageCount: chat.messages.length,
      lastMessage: chat.messages.at(-1)?.text.slice(0, 120) ?? null,
      turnState: chat.latestTurn?.state ?? null,
    };
    /**
     * The list is read two ways under this key — a single newest-first page,
     * and the sidebar's infinite pages — and a new session belongs at the head
     * of both. Only the first page is touched: it is the one the top of the
     * list is drawn from, and the pages below it are already past this session.
     */
    queryClient.setQueriesData<unknown>(
      { queryKey: ["get", "/api/chats"] },
      (old: unknown) => {
        const head = (page: ChatPage): ChatPage => ({
          ...page,
          items: [summary, ...page.items.filter((c) => c.id !== summary.id)],
        });
        if (!isRecord(old)) return old;
        if (Array.isArray(old["pages"])) {
          const [first, ...rest] = old["pages"] as ReadonlyArray<ChatPage>;
          return first === undefined
            ? old
            : { ...old, pages: [head(first), ...rest] };
        }
        return Array.isArray(old["items"]) ? head(old as ChatPage) : old;
      }
    );
  };

  return {
    start: async (
      settings: ChatSettings,
      branch: string,
      text: string,
      images: ReadonlyArray<ChatImage> = []
    ) => {
      const started = await fns.start(settings, branch, text, images);
      if (started !== null) {
        prependChat(started);
        invalidate();
      }
      return started;
    },
    startWithTitle: async (
      settings: ChatSettings,
      branch: string,
      title: string,
      text: string,
      images: ReadonlyArray<ChatImage> = []
    ) => {
      const started = await fns.startWithTitle(
        settings,
        branch,
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
    remove: async (id: string) => {
      await fns.remove(id);
      // Drop the conversation the live view seeds itself from, so a deleted
      // session can't be reopened from cache.
      queryClient.removeQueries({ queryKey: chatQueryOptions(id).queryKey });
      invalidate();
    },
  };
}
