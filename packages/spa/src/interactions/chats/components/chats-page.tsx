/**
 * ChatsPage — the sessions surface: every session in the repo listed beside the
 * routed conversation (the new-session composer on the index, a conversation on
 * /agent-session/$chatId).
 *
 * The sidebar is the list and nothing else — minting a session and searching for
 * one both live in the toolbar above it. The one control it does carry hangs off
 * the "Recents" heading and only appears under the pointer: a time window, which
 * is the filter that stays useful once branch is no longer how these are sorted.
 *
 * Arriving marks the inbox seen, so the rail's dot only stands for sessions that
 * moved since you last looked; the rows keep comparing against the mark this
 * visit started with, so nothing goes read out from under you.
 */
import {
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconClock,
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter";
import { useWindowTabs } from "@/interactions/window-tabs/adapters/window-tabs.store";
import { ChatRow } from "@/interactions/chats/components/chat-row";
import { isChatUnread } from "@/interactions/chats/functions/chat-unread.functions";
import { openSessionTab } from "@/interactions/chats/functions/open-session-tab";
import { DATE_FILTERS, dateCutoff, type DateFilter } from "@/lib/date-filter";
import { useChats } from "@/lib/queries";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

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

  const summaries = useMemo(() => chats.data ?? [], [chats.data]);
  const selected = summaries.find((c) => c.id === chatId) ?? null;

  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const filtered = useMemo(() => {
    const cutoff = dateCutoff(dateFilter);
    if (cutoff === 0) return summaries;
    return summaries.filter((c) => Date.parse(c.updatedAt) >= cutoff);
  }, [summaries, dateFilter]);

  const remove = async (id: string) => {
    try {
      await actions.remove(id);
      if (id === chatId) void navigate({ to: "/modes/agent-session" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "delete failed");
    }
  };

  // Starting a session gets the whole pane: there is nothing to pick from a list
  // yet, and the composer is the only thing on screen worth looking at.
  const composing = chatId === undefined;
  const showList = !composing && !expanded && prefs.sidebarVisible;

  /**
   * Back to the list. A session already has one to step out to, but the composer
   * does not — nothing has been said yet, so there is no conversation for the
   * list to sit beside, and the way back is to leave the composer.
   */
  const showSessions = () => {
    setOverride(false);
    if (composing) void navigate({ to: "/modes/agent-session" });
  };

  /**
   * ⌘-click is "open elsewhere" everywhere else, so here it lifts the same
   * conversation into a tab of its own rather than widening this one.
   */
  const toggleExpanded = (event: React.MouseEvent) => {
    if ((event.metaKey || event.ctrlKey) && selected !== null) {
      openSessionTab(selected.id, selected.title);
      // The conversation is already the one on screen, so there is nowhere to
      // navigate — dropping the override lets the new tab settle into the full
      // width a session tab gets by default.
      setOverride(null);
      return;
    }
    setOverride(!expanded);
  };

  return (
    <div className="flex h-full min-h-0">
      {showList && (
        <aside
          className="flex shrink-0 flex-col border-r"
          style={{ width: listWidth }}
        >
          <ScrollArea
            className="min-h-0 flex-1"
            viewportClassName="scroll-fade"
          >
            {summaries.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No sessions yet. Send a message to start one.
              </p>
            ) : (
              <div className="flex flex-col gap-px px-2 pt-2 pb-2">
                <div className="group/heading flex h-7 items-center gap-1 pr-1 pl-2">
                  <h2 className="text-xs font-medium text-muted-foreground">
                    Recents
                  </h2>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Filter by time"
                          className={cn(
                            "relative size-6 text-muted-foreground opacity-0 transition-opacity group-hover/heading:opacity-100 focus-visible:opacity-100",
                            dateFilter !== "all" && "opacity-100"
                          )}
                        />
                      }
                    >
                      <IconClock className="size-3.5" />
                      {dateFilter !== "all" && (
                        <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-brand-500" />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-40">
                      <DropdownMenuRadioGroup
                        value={dateFilter}
                        onValueChange={(v) => setDateFilter(v as DateFilter)}
                      >
                        {DATE_FILTERS.map((d) => (
                          <DropdownMenuRadioItem key={d.value} value={d.value}>
                            {d.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {filtered.length === 0 ? (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No sessions in this window.
                  </p>
                ) : (
                  filtered.map((c) => (
                    <ChatRow
                      key={c.id}
                      chat={c}
                      active={c.id === chatId}
                      unread={isChatUnread(c, seenAt)}
                      onDelete={() => void remove(c.id)}
                    />
                  ))
                )}
              </div>
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
          label="Resize the session list"
        />
      )}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PaneHeader
          crumbs={[
            // A session with the pane to itself — a new one included — needs the
            // way back said out loud, since the list it came from is not on
            // screen to click.
            ...(expanded
              ? [
                  <button
                    key="sessions"
                    type="button"
                    onClick={showSessions}
                    className="shrink-0 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
                  >
                    Sessions
                  </button>,
                ]
              : []),
            <span key="thread" className="truncate font-medium">
              {selected?.title ?? "New session"}
            </span>,
          ]}
          {...(selected !== null
            ? {
                actions: (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    aria-label={
                      expanded
                        ? "Exit full width (⌘-click to open in a new tab)"
                        : "Expand full (⌘-click to open in a new tab)"
                    }
                    onClick={toggleExpanded}
                  >
                    {expanded ? (
                      <IconArrowsDiagonalMinimize2 className="size-4" />
                    ) : (
                      <IconArrowsDiagonal className="size-4" />
                    )}
                  </Button>
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
