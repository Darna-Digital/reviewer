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
 * There is no header over this surface at all. Nothing the toolbar carries is
 * about the list — the rail holds what acts on it — and the conversation is
 * named by the row that opened it. A band across both columns stopped the seam
 * between them short of the window bar; a trail over the conversation alone
 * was a row of chrome saying what the list beside it already said. With
 * neither, both columns start at the top of the window and the seam runs the
 * whole height of it. See `AppLayout`.
 *
 * Which rows are still waiting is the sessions' own business: each carries the
 * moment it was last opened, so a row settles when you open its conversation
 * rather than when you next arrive here. See `chats.attention.ts`.
 *
 * Rows can also be acted on in bulk: ⇧-click sweeps the run between the row
 * last clicked and this one, and a right-click anywhere in the sweep opens the
 * menu that deletes all of it at once. A right-click outside the sweep drops it
 * and is about the one row under the pointer, so the menu never acts on
 * sessions that are not under it. See `lib/row-selection`.
 *
 * Inside the macOS shell the list is the window's sidebar rather than this
 * page's column: the rows are handed over and drawn natively, and what was
 * done to them comes back here. See `chats-page.shell`.
 */
import { IconExternalLink, IconTrash } from "@tabler/icons-react";
import {
  Outlet,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SidebarResizeHandle } from "@/components/layout/sidebar-resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { confirm } from "@/components/ui/alerts";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { pointerAnchor } from "@/interactions/language/functions/anchors";
import { useChatFilters } from "@/interactions/chats/adapters/chat-filters.store";
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter";
import { useChatListQuery } from "@/interactions/chats/adapters/chat-list-query.hook.adapter";
import { useOnSessionTab } from "@/interactions/window-tabs/adapters/window-tabs.store";
import { ChatRow } from "@/interactions/chats/components/chat-row";
import {
  shellDrawsSessions,
  useShellSessions,
} from "@/interactions/chats/components/chats-page.shell";
import { resolveProjectFilter } from "@/interactions/chats/functions/chat-filters.functions";
import { openSessionTab } from "@/interactions/chats/functions/open-session-tab";
import { useChatPages, useChatProjects } from "@/lib/queries";
import {
  NO_ROWS,
  anchorRow,
  extendToRow,
  selectRow,
  selectedRows,
  type RowSelection,
} from "@/lib/row-selection";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import type { ChatProjectTally } from "@reviewer/core/chats";

/** How close to the foot of the loaded list fetches the next page. */
const LOAD_MORE_WITHIN_PX = 400;

const NO_PROJECTS: ReadonlyArray<ChatProjectTally> = [];

/**
 * What the shell's filter menu shows: the stored filters as `SessionFilters`
 * reads them — the project resolved against the ones that exist — and the
 * projects it could name. Fetched only in the shell, where the menu is.
 */
function useShellFilters(search: string) {
  const projects = useChatProjects(shellDrawsSessions).data ?? NO_PROJECTS;
  const stored = useChatFilters();
  const project = resolveProjectFilter(projects, stored.project);
  const filters = useMemo(
    () => ({ search, project, date: stored.date }),
    [search, project, stored.date]
  );
  return { filters, projects };
}

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
  const showList =
    !composing && !ownTab && prefs.sidebarVisible && !shellDrawsSessions;
  /** The surface with the list on it and nothing yet opened from it. */
  const landing = !composing && !ownTab && chatId === undefined;
  /**
   * The shell's sidebar draws the list wherever inside Sessions the page is —
   * it is the window's column, not this page's — so the rows are fetched for
   * it even where the web list would be down.
   */
  const listed = showList || shellDrawsSessions;

  // The filters go to the server with the page — see `useChatPages`. The
  // shell's search field is the one narrowing the web rail's popover does
  // with a list of its own: here it goes into the same query, so the native
  // list is the hits.
  const stored = useChatListQuery();
  const [shellSearch, setShellSearch] = useState("");
  const filters = useMemo(
    () =>
      shellSearch.length === 0 ? stored : { ...stored, search: shellSearch },
    [stored, shellSearch]
  );
  // Not fetched at all where there is neither a list to fill nor a session to
  // land on: the composer and a session in its own tab are whole pages that
  // happen to hang off this one.
  const { sessions, loading, hasMore, loadMore } = useChatPages(
    filters,
    listed || landing
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

  /**
   * The sweep a right-click acts on. ⇧-click is what makes one — see
   * `lib/row-selection` — and it is held here rather than in the row, since a
   * range is a fact about the list.
   *
   * Read back against the loaded list on every render, so rows that a filter,
   * a refetch or a delete took away are not still selected in the dark.
   */
  const [selection, setSelection] = useState<RowSelection>(NO_ROWS);
  const order = sessions.map((c) => c.id);
  const selected = selectedRows(order, selection);
  const selectedSet = new Set(selected);

  const [menu, setMenu] = useState<{
    readonly ids: ReadonlyArray<string>;
    readonly anchor: ReturnType<typeof pointerAnchor>;
  } | null>(null);

  /**
   * A right-click acts on the sweep it lands inside; landing anywhere else the
   * sweep is dropped and the menu is about that one row, which is what makes
   * "select, then right-click" safe to do without aiming.
   */
  const openMenu = (id: string, x: number, y: number) => {
    const ids = selectedSet.has(id) ? selected : [id];
    if (!selectedSet.has(id)) setSelection(selectRow(id));
    setMenu({ ids, anchor: pointerAnchor(x, y) });
  };

  const remove = async (ids: ReadonlyArray<string>) => {
    if (ids.length === 0) return;
    // One session goes the way it always has — the ✕ on the row asks nothing
    // either. A sweep is the case where a mis-aimed click costs more than the
    // row under the pointer, so that is the one worth stopping for.
    if (
      ids.length > 1 &&
      !(await confirm({
        title: `Delete ${ids.length} sessions?`,
        description: "Their conversations go with them. This can't be undone.",
        confirmLabel: `Delete ${ids.length}`,
        destructive: true,
      }))
    ) {
      return;
    }
    await removeConfirmed(ids);
  };

  const removeConfirmed = async (ids: ReadonlyArray<string>) => {
    setSelection(NO_ROWS);
    const failed = await actions.removeMany(ids);
    if (failed.length > 0) {
      const [first] = failed;
      toast.error(
        failed.length === 1
          ? (first?.message ?? "delete failed")
          : `${failed.length} sessions could not be deleted`
      );
    }
    const gone = ids.filter((id) => !failed.some((f) => f.id === id));
    if (chatId !== undefined && gone.includes(chatId)) {
      void navigate({ to: "/modes/agent-session" });
    }
  };

  const shellFilters = useShellFilters(shellSearch);
  useShellSessions(
    shellDrawsSessions
      ? {
          sessions,
          activeId: chatId ?? null,
          loading,
          hasMore,
          filters: shellFilters.filters,
          projects: shellFilters.projects,
          loadMore: () => void loadMore(),
          remove: (ids) => void removeConfirmed(ids),
          search: setShellSearch,
        }
      : null
  );

  return (
    <div className="app-split flex h-full min-h-0 gap-1.5">
      {showList && (
        <aside
          className="app-sheet flex shrink-0 flex-col overflow-hidden"
          style={list.style}
        >
          <ScrollArea
            className="min-h-0 flex-1"
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
                      selected={selectedSet.has(c.id)}
                      onSelect={() => setSelection(anchorRow(c.id))}
                      onExtendSelection={() =>
                        setSelection(extendToRow(order, selection, c.id))
                      }
                      onOpenMenu={(x, y) => openMenu(c.id, x, y)}
                      onDelete={() => void remove([c.id])}
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
          className="resize-handle-seam"
        />
      )}
      <section className="app-sheet flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
      </section>
      {menu !== null && (
        <ContextMenu
          open
          onOpenChange={(open) => {
            if (!open) setMenu(null);
          }}
        >
          <ContextMenuContent
            anchor={menu.anchor}
            side="bottom"
            align="start"
            className="min-w-52"
          >
            {menu.ids.length === 1 && (
              <>
                <ContextMenuItem
                  onClick={() => {
                    const id = menu.ids[0];
                    const session = sessions.find((c) => c.id === id);
                    if (session !== undefined) {
                      openSessionTab(session.id, session.title);
                    }
                    setMenu(null);
                  }}
                >
                  <IconExternalLink /> Open in a tab
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            <ContextMenuItem
              variant="destructive"
              onClick={() => {
                setMenu(null);
                void remove(menu.ids);
              }}
            >
              <IconTrash />
              {menu.ids.length === 1
                ? "Delete session"
                : `Delete ${menu.ids.length} sessions`}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}
    </div>
  );
}
