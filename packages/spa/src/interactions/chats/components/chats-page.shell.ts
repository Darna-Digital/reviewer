/**
 * The sessions list, handed to the native shell.
 *
 * In the macOS window the sidebar is the window's own: while the page is on
 * the sessions surface the shell draws the list there natively — the rows
 * `ChatsPage` would put beside the conversation — from a picture of what the
 * page has loaded, and sends back what was done to it. The fetch, the
 * filters, the marks and every action on a session stay this page's; the
 * shell only ever asks.
 *
 * The web list hides on a session's own tab, since a tab holds one
 * conversation. The native one does not: the sidebar is the window's, not the
 * tab's, so it stays up wherever inside Sessions the page is, and a row picked
 * from a session's tab shows on the Sessions tab — the list's own — the way a
 * click in the web list always did.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { setChatFilters } from "@/interactions/chats/adapters/chat-filters.store";
import { invalidateChatList } from "@/interactions/chats/adapters/chats.cache";
import { openSessionTab } from "@/interactions/chats/functions/open-session-tab";
import { updateWindowTabs } from "@/interactions/window-tabs/adapters/window-tabs.store";
import {
  SESSIONS_TAB_ID,
  selectTab,
} from "@/interactions/window-tabs/functions/window-tabs.functions";
import {
  island,
  shell,
  type ShellSession,
  type ShellSessionAction,
  type ShellSessionFilters,
  type ShellSessions,
} from "@/lib/shell";
import {
  isChatUnread,
  unattendedTurnState,
  type ChatProjectTally,
  type ChatSummary,
} from "@reviewer/core/chats";

/** Whether the list is the shell's to draw rather than this document's. */
export const shellDrawsSessions = island === "code";

/**
 * Whether the conversation is the shell's to draw too — natively, in this
 * page's place, from its own reading of the chat stream — so the routed
 * `ChatView` and the composer stand down here rather than stream a second
 * copy under it. See the shell's `Chats`.
 */
export const shellDrawsConversation = island === "code";

/** What the shell's list is drawn from, and what its rows can do. */
export interface ShellSessionsSource {
  readonly sessions: ReadonlyArray<ChatSummary>;
  readonly activeId: string | null;
  readonly loading: boolean;
  readonly hasMore: boolean;
  readonly filters: Omit<ShellSessionFilters, "projects">;
  readonly projects: ReadonlyArray<ChatProjectTally>;
  readonly loadMore: () => void;
  /** The shell has asked what it needs to: a sweep is not confirmed again. */
  readonly remove: (ids: ReadonlyArray<string>) => void;
  /** The shell's field: held by the page, since the query is the page's. */
  readonly search: (text: string) => void;
}

const sessionRow = (chat: ChatSummary): ShellSession => {
  const turn = unattendedTurnState(chat);
  return {
    id: chat.id,
    title: chat.title,
    origin:
      chat.origin.repoName === chat.origin.projectName
        ? chat.origin.projectName
        : `${chat.origin.projectName}/${chat.origin.repoName}`,
    updatedAt: chat.updatedAt,
    mark:
      turn === "running" || turn === "error"
        ? turn
        : isChatUnread(chat)
          ? "unread"
          : null,
    messageCount: chat.messageCount,
    lastMessage: chat.lastMessage,
  };
};

/**
 * Keep the shell's list in step with `source`, and its actions flowing back
 * into it; null where the page is off the surface, which takes the list down.
 */
export function useShellSessions(source: ShellSessionsSource | null): void {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const latest = useRef(source);
  latest.current = source;

  const sessions = source?.sessions ?? null;
  const activeId = source?.activeId ?? null;
  const loading = source?.loading ?? false;
  const hasMore = source?.hasMore ?? false;
  const filters = source?.filters ?? null;
  const projects = source?.projects ?? null;
  const list = useMemo<ShellSessions | null>(
    () =>
      shellDrawsSessions &&
      sessions !== null &&
      filters !== null &&
      projects !== null
        ? {
            sessions: sessions.map(sessionRow),
            activeId,
            loading,
            hasMore,
            filters: { ...filters, projects },
          }
        : null,
    [sessions, activeId, loading, hasMore, filters, projects]
  );
  useEffect(() => {
    if (!shellDrawsSessions) return;
    void shell.post({ type: "sessions", list });
  }, [list]);
  useEffect(() => {
    if (!shellDrawsSessions) return;
    return () => void shell.post({ type: "sessions", list: null });
  }, []);

  useEffect(() => {
    if (!shellDrawsSessions) return;
    const act = (action: ShellSessionAction) => {
      // The shell's conversation moved; the rows are stale whatever the
      // page is holding for them.
      if (action.kind === "refetch") return invalidateChatList(queryClient);
      const current = latest.current;
      if (current === null) return;
      switch (action.kind) {
        case "select": {
          // The list's own tab, whichever tab the page was on: a session tab
          // holds one conversation, and a row is not a request to swap it.
          updateWindowTabs((state) => selectTab(state, SESSIONS_TAB_ID));
          void navigate({
            to: "/modes/agent-session/$chatId",
            params: { chatId: action.id },
          });
          return;
        }
        case "openInTab": {
          const session = current.sessions.find((c) => c.id === action.id);
          if (session === undefined) return;
          openSessionTab(session.id, session.title);
          void navigate({
            to: "/modes/agent-session/$chatId",
            params: { chatId: session.id },
          });
          return;
        }
        case "delete":
          return current.remove(action.ids);
        case "loadMore":
          return current.loadMore();
        case "search":
          return current.search(action.text);
        case "filter":
          return setChatFilters({
            ...(action.project === undefined
              ? {}
              : { project: action.project }),
            ...(action.date === undefined ? {} : { date: action.date }),
          });
      }
    };
    return shell.subscribe((event) => {
      if (event.type === "sessions") act(event.action);
    });
  }, [navigate, queryClient]);
}
