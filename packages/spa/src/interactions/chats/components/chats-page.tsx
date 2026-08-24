/**
 * ChatsPage — the sessions surface: every session, from every project, listed
 * beside the routed conversation (the newest of them on the way in, whichever
 * you pick after that).
 *
 * Sessions are stored centrally, so this list is not the open project's — it is
 * all of them, newest first, and a conversation started in another project
 * opens and answers here exactly like one started in this one.
 *
 * The sidebar is the list and nothing else: minting a session, searching for
 * one and narrowing which of them are listed all live in the rail beside it.
 * The filters are kept across visits — narrowing to a project says what you are
 * working on, which does not stop being true when you open a session. See
 * `SessionFilters`.
 *
 * The list is fetched a page at a time and grows as it is scrolled, so both
 * filters — and the rail's search — are part of what is asked for rather than
 * applied to what came back. See `useChatPages`.
 *
 * Which rows are still waiting is the sessions' own business: each carries the
 * moment it was last opened, so a row settles when you open its conversation
 * rather than when you next arrive here. See `chats.attention.ts`.
 */
import {
  Outlet,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { SidebarResizeHandle } from "@/components/layout/sidebar-resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter";
import { useChatListQuery } from "@/interactions/chats/adapters/chat-list-query.hook.adapter";
import { useOnSessionTab } from "@/interactions/window-tabs/adapters/window-tabs.store";
import { ChatRow } from "@/interactions/chats/components/chat-row";
import { useChatPages } from "@/lib/queries";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";

/** How close to the foot of the loaded list fetches the next page. */
const LOAD_MORE_WITHIN_PX = 400;

export function ChatsPage() {
  const actions = useChatsActions();
  const navigate = useNavigate();
  const { chatId } = useParams({ strict: false });
  const prefs = useUiPrefs();
  // Not React state: a drag would otherwise re-render this whole page, and
  // its list of sessions, on every pointer frame. See `usePanelSize`.
  const list = usePanelSize("chats-list-w", prefs.inboxListWidth, "width");
  /**
   * A session tab holds one conversation, so on one of those the thread is the
   * whole pane and the list stays out of it — landing in the inbox you
   * deliberately stepped past would be the surprise. ⌘-clicking a row is how a
   * conversation is lifted into one; the toolbar's crumb is the way back.
   *
   * The shell asks the same question of the same store: with no list here,
   * there is no rail beside it either. See `ShellRoute`.
   */
  const ownTab = useOnSessionTab();

  // Starting a session gets the whole pane: the composer is the only thing on
  // screen worth looking at, and it is the one place under here that asks for
  // that.
  const composing = useSearch({ strict: false }).new === true;
  const showList = !composing && !ownTab && prefs.sidebarVisible;
  /** The surface with the list on it and nothing yet opened from it. */
  const landing = !composing && !ownTab && chatId === undefined;

  // The filters go to the server with the page — see `useChatPages`.
  const filters = useChatListQuery();
  // Not fetched at all where there is neither a list to fill nor a session to
  // land on: the composer and a session in its own tab are whole pages that
  // happen to hang off this one.
  const { sessions, loading, hasMore, loadMore } = useChatPages(
    filters,
    showList || landing
  );

  /**
   * Landing on the surface opens the newest session the filters leave in the
   * list — the first row, since it arrives newest-first. The empty pane beside
   * a list is a page asking you to click the thing it is already pointing at,
   * and the one you were last in is nearly always the one you came back for.
   *
   * It is the *filtered* list's newest, so narrowing to a project and coming
   * back lands in that project's work rather than in whatever ran last
   * somewhere else. `replace` keeps the pane you passed through out of the
   * history, which you would otherwise land back on and be moved off again.
   */
  useEffect(() => {
    const latest = sessions[0];
    if (!landing || latest === undefined) return;
    void navigate({
      to: "/modes/agent-session/$chatId",
      params: { chatId: latest.id },
      replace: true,
    });
  }, [landing, sessions, navigate]);

  /**
   * Fetch the next page as its foot comes into reach, rather than at the very
   * bottom — the page is on its way before the reader arrives, so a list of a
   * thousand sessions scrolls like a list that was all there.
   */
  const listViewport = useRef<HTMLDivElement | null>(null);
  const onListScroll = () => {
    const el = listViewport.current;
    if (el === null || !hasMore) return;
    if (
      el.scrollHeight - el.scrollTop - el.clientHeight <
      LOAD_MORE_WITHIN_PX
    ) {
      void loadMore();
    }
  };
  // A window taller than the first page has nothing to scroll towards, so the
  // next one is asked for here instead.
  useEffect(() => {
    const el = listViewport.current;
    if (el === null || !hasMore || loading) return;
    if (el.scrollHeight <= el.clientHeight) void loadMore();
  }, [hasMore, loading, sessions.length, loadMore]);

  const remove = async (id: string) => {
    try {
      await actions.remove(id);
      if (id === chatId) void navigate({ to: "/modes/agent-session" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "delete failed");
    }
  };

  return (
    <div className="flex h-full min-h-0">
      {showList && (
        <aside className="flex shrink-0 flex-col border-r" style={list.style}>
          <ScrollArea
            className="min-h-0 flex-1"
            viewportClassName="scroll-fade"
            onViewportScroll={onListScroll}
            viewportRef={listViewport}
          >
            {sessions.length === 0 && !loading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No sessions yet. Send a message to start one.
              </p>
            ) : (
              <div className="flex flex-col gap-px px-2 pt-2 pb-2">
                {sessions.length === 0 && !loading ? (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No sessions match these filters.
                  </p>
                ) : (
                  sessions.map((c) => (
                    <ChatRow
                      key={c.id}
                      chat={c}
                      active={c.id === chatId}
                      onDelete={() => void remove(c.id)}
                    />
                  ))
                )}
                {/* The foot of the loaded list. Scrolling near it fetches the
                    next page, so the list simply keeps going; it says so only
                    while a page is actually in flight. */}
                {hasMore && (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                    Loading more…
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        </aside>
      )}
      {showList && (
        <SidebarResizeHandle
          width={list.current}
          stored={prefs.inboxListWidth}
          max={() => Math.max(320, window.innerWidth - 480)}
          onResize={list.onResize}
          onResizeEnd={(w) => setUiPrefs({ inboxListWidth: w })}
          label="Resize the session list"
        />
      )}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </section>
    </div>
  );
}
