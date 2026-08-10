/**
 * ChatsPage — code mode's inbox: the repo's agent threads listed beside the
 * routed conversation (the new-thread composer on the index, a conversation on
 * /chats/$chatId). Same two panes as the collaboration inbox, over real data.
 *
 * The list filters by branch (grouped like the terminal threads, defaulting to
 * the current checkout), a time window, and a free-text search over titles and
 * last messages. Arriving marks the inbox seen, so the rail's dot only stands
 * for threads that moved since you last looked; the rows keep comparing against
 * the mark this visit started with, so nothing goes read out from under you.
 */
import {
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconGitBranch,
  IconMessage,
  IconPlus,
} from "@tabler/icons-react";
import {
  Outlet,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PaneHeader } from "@/components/layout/pane-header";
import { SidebarResizeHandle } from "@/components/layout/sidebar-resize-handle";
import {
  ALL_BRANCHES,
  branchLabel,
  SidebarFilterMenu,
  SidebarSearch,
} from "@/components/layout/sidebar-filters";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter";
import { useWindowTabs } from "@/interactions/window-tabs/adapters/window-tabs.store";
import { ChatRow } from "@/interactions/chats/components/chat-row";
import { isChatUnread } from "@/interactions/chats/functions/chat-unread.functions";
import type { ChatSummary } from "@byconvo/core/chats";
import { dateCutoff, type DateFilter } from "@/lib/date-filter";
import { useBranches, useChats, useRepo } from "@/lib/queries";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";

export function ChatsPage() {
  const chats = useChats();
  const actions = useChatsActions();
  const navigate = useNavigate();
  const { chatId } = useParams({ strict: false });
  const prefs = useUiPrefs();
  const [listWidth, setListWidth] = useState(prefs.inboxListWidth);
  /**
   * A session tab holds one conversation, so on one of those the thread is the
   * whole pane and the list stays out of it — landing in the inbox you
   * deliberately stepped past would be the surprise. The crumb is the way back,
   * and choosing either way holds for the visit.
   */
  const { tabs, activeId } = useWindowTabs();
  const startingNew = useSearch({ strict: false }).new === true;
  const ownTab =
    startingNew || tabs.find((tab) => tab.id === activeId)?.kind === "session";
  const [override, setOverride] = useState<boolean | null>(null);
  const expanded = override ?? ownTab;

  const [seenAt] = useState(prefs.inboxSeenAt);
  useEffect(() => {
    setUiPrefs({ inboxSeenAt: new Date().toISOString() });
  }, []);

  const repo = useRepo();
  const branchesQuery = useBranches();
  const currentBranch = repo.data?.currentBranch ?? "";
  const localBranches = useMemo(
    () => (branchesQuery.data ?? []).map((b) => b.name),
    [branchesQuery.data]
  );

  const summaries = useMemo(() => chats.data ?? [], [chats.data]);
  const selected = summaries.find((c) => c.id === chatId) ?? null;

  // Branch the list is filtered to (null → follow the current branch).
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [search, setSearch] = useState("");
  const activeBranch = branchFilter ?? (currentBranch || ALL_BRANCHES);

  // Branches offered in the filter: current + local + any a chat already uses.
  const filterBranches = useMemo(() => {
    const set = new Set<string>();
    if (currentBranch) set.add(currentBranch);
    localBranches.forEach((b) => set.add(b));
    summaries.forEach((c) => c.branch && set.add(c.branch));
    return [...set].sort((a, b) =>
      a === currentBranch ? -1 : b === currentBranch ? 1 : a.localeCompare(b)
    );
  }, [currentBranch, localBranches, summaries]);

  // Chats surviving the date + search filters (branch is applied via grouping).
  const filtered = useMemo(() => {
    const cutoff = dateCutoff(dateFilter);
    const q = search.trim().toLowerCase();
    return summaries.filter((c) => {
      if (cutoff > 0 && Date.parse(c.updatedAt) < cutoff) return false;
      if (q.length > 0) {
        const haystack = `${c.title}\n${c.lastMessage ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [summaries, dateFilter, search]);

  // Chats grouped under their branch, in the same order as the filter.
  const groups = useMemo(() => {
    const present = [...new Set(filtered.map((c) => c.branch))].sort((a, b) =>
      a === currentBranch ? -1 : b === currentBranch ? 1 : a.localeCompare(b)
    );
    const branchesToShow =
      activeBranch === ALL_BRANCHES ? present : [activeBranch];
    return branchesToShow.map((branch) => ({
      branch,
      chats: filtered.filter((c) => c.branch === branch),
    }));
  }, [filtered, activeBranch, currentBranch]);

  const hasMatches = groups.some((g) => g.chats.length > 0);
  const filtersActive =
    activeBranch !== ALL_BRANCHES ||
    dateFilter !== "all" ||
    search.trim().length > 0;

  const remove = async (id: string) => {
    try {
      await actions.remove(id);
      if (id === chatId) void navigate({ to: "/modes/code/chats" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "delete failed");
    }
  };

  const renderRow = (c: ChatSummary) => (
    <ChatRow
      key={c.id}
      chat={c}
      active={c.id === chatId}
      unread={isChatUnread(c, seenAt)}
      onDelete={() => void remove(c.id)}
    />
  );

  // Starting a thread gets the whole pane: there is nothing to pick from a list
  // yet, and the composer is the only thing on screen worth looking at.
  const composing = chatId === undefined;
  const showList = !composing && !expanded && prefs.sidebarVisible;

  return (
    <div className="flex h-full min-h-0">
      {showList && (
        <aside
          className="flex shrink-0 flex-col border-r"
          style={{ width: listWidth }}
        >
          <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-2">
            <SidebarSearch
              label="Search threads"
              placeholder="Search threads…"
              value={search}
              onChange={setSearch}
            />
            {/* Filters — branch (groups chats, defaulting to the current
              checkout) and time window, combined behind one dropdown. */}
            <SidebarFilterMenu
              label="Filter threads"
              branchValue={activeBranch}
              branches={filterBranches}
              onBranchChange={setBranchFilter}
              dateValue={dateFilter}
              onDateChange={setDateFilter}
              active={filtersActive}
            />
            <Button
              size="icon"
              variant="ghost"
              className="size-7 shrink-0"
              aria-label="New thread"
              onClick={() =>
                void navigate({
                  to: "/modes/code/chats",
                  search: { new: true },
                })
              }
            >
              <IconPlus className="size-4" />
            </Button>
          </div>
          <ScrollArea
            className="min-h-0 flex-1"
            viewportClassName="scroll-fade"
          >
            {summaries.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No threads yet. Send a message to start one.
              </p>
            ) : !hasMatches ? (
              <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No threads match these filters.
                </p>
                {filtersActive && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      setBranchFilter(ALL_BRANCHES);
                      setDateFilter("all");
                      setSearch("");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            ) : activeBranch === ALL_BRANCHES ? (
              // Grouped under branch headers when viewing all branches.
              groups
                .filter((g) => g.chats.length > 0)
                .map((group) => (
                  <div key={group.branch}>
                    <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      <IconGitBranch className="size-3 shrink-0" />
                      <span className="truncate">
                        {branchLabel(group.branch)}
                      </span>
                      <span className="ml-auto tabular-nums">
                        {group.chats.length}
                      </span>
                    </div>
                    {group.chats.map(renderRow)}
                  </div>
                ))
            ) : (
              // A single branch is selected — the filter is the header.
              groups[0]?.chats.map(renderRow)
            )}
          </ScrollArea>
        </aside>
      )}
      {showList && (
        <SidebarResizeHandle
          width={listWidth}
          stored={prefs.inboxListWidth}
          max={() => Math.max(320, window.innerWidth - 480)}
          onResize={setListWidth}
          onResizeEnd={(w) => setUiPrefs({ inboxListWidth: w })}
          label="Resize the thread list"
        />
      )}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PaneHeader
          crumbs={
            expanded && selected !== null
              ? [
                  <button
                    key="inbox"
                    type="button"
                    onClick={() => setOverride(false)}
                    className="shrink-0 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
                  >
                    Inbox
                  </button>,
                  <span key="branch" className="truncate text-muted-foreground">
                    {branchLabel(selected.branch)}
                  </span>,
                  <span key="thread" className="truncate font-medium">
                    {selected.title}
                  </span>,
                ]
              : [
                  <span key="thread" className="truncate font-medium">
                    {selected?.title ?? "New thread"}
                  </span>,
                ]
          }
          {...(selected !== null && !expanded
            ? { meta: branchLabel(selected.branch) }
            : {})}
          {...(selected !== null
            ? {
                actions: (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <IconMessage className="size-4" />
                    <span className="text-xs tabular-nums">
                      {selected.messageCount}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={expanded ? "Exit full width" : "Expand full"}
                      onClick={() => setOverride(!expanded)}
                    >
                      {expanded ? (
                        <IconArrowsDiagonalMinimize2 className="size-4" />
                      ) : (
                        <IconArrowsDiagonal className="size-4" />
                      )}
                    </Button>
                  </div>
                ),
              }
            : {})}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
      </section>
    </div>
  );
}
