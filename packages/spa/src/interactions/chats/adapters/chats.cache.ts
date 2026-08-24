/**
 * The sessions list as the query cache holds it. Two reads share the key: the
 * rail's single newest-first page and the sidebar's infinite pages — so a write
 * the list has to show at once (a session just started, a session just read)
 * is made in both shapes here rather than in each caller.
 *
 * These are edits, not refetches. The server already knows; what is wanted is
 * the row settling under the pointer instead of a page-load later.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { ChatPage, ChatSummary } from "@byconvo/core/chats";

/** Every cached read of the sessions list, in either shape. */
const CHAT_LIST_KEY = ["get", "/api/chats"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Rewrites each cached page through `edit`, which is given the page's position
 * so a caller can touch only the head of the list.
 */
const rewritePages = (
  queryClient: QueryClient,
  edit: (page: ChatPage, index: number) => ChatPage
): void => {
  queryClient.setQueriesData<unknown>(
    { queryKey: CHAT_LIST_KEY },
    (old: unknown) => {
      if (!isRecord(old)) return old;
      if (Array.isArray(old["pages"])) {
        const pages = old["pages"] as ReadonlyArray<ChatPage | undefined>;
        return {
          ...old,
          pages: pages.map((page, index) =>
            page === undefined ? page : edit(page, index)
          ),
        };
      }
      return Array.isArray(old["items"]) ? edit(old as ChatPage, 0) : old;
    }
  );
};

export const invalidateChatList = (queryClient: QueryClient): void => {
  void queryClient.invalidateQueries({ queryKey: CHAT_LIST_KEY });
};

/**
 * Puts a freshly-started session at the head of the list, before the refetch
 * lands. Only the first page is touched: it is what the top of the list is
 * drawn from, and the pages below it are already past this session.
 */
export const prependChatSummary = (
  queryClient: QueryClient,
  summary: ChatSummary
): void =>
  rewritePages(queryClient, (page, index) =>
    index > 0
      ? page
      : {
          ...page,
          items: [summary, ...page.items.filter((c) => c.id !== summary.id)],
        }
  );

/**
 * Patches one session wherever the cache holds it — any page, since the session
 * being read may be a long way down the list.
 */
export const patchChatSummary = (
  queryClient: QueryClient,
  id: string,
  patch: Partial<ChatSummary>
): void =>
  rewritePages(queryClient, (page) =>
    page.items.some((c) => c.id === id)
      ? {
          ...page,
          items: page.items.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }
      : page
  );
