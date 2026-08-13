/**
 * ChatsPage — the sessions surface: every session, from every project, listed
 * beside the routed conversation (the new-session composer on the index, a
 * conversation on /agent-session/$chatId).
 *
 * Sessions are stored centrally, so this list is not the open project's — it is
 * all of them, newest first, and a conversation started in another project
 * opens and answers here exactly like one started in this one.
 *
 * The sidebar is the list and nothing else — minting a session and searching for
 * one both live in the toolbar above it. The two controls it does carry hang off
 * the "Recents" heading and only appear under the pointer: a time window, and
 * the project, which is the axis that arrived with the list spanning all of
 * them. A chosen filter keeps its control visible, so the list is never quietly
 * narrower than it looks, and it is kept across visits — narrowing to a project
 * says what you are working on, which does not stop being true when you open a
 * session.
 *
 * Arriving marks the inbox seen, so the rail's dot only stands for sessions that
 * moved since you last looked; the rows keep comparing against the mark this
 * visit started with, so nothing goes read out from under you.
 */
import { IconClock, IconFolder } from "@tabler/icons-react";
import {
  Outlet,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import {
  ALL_PROJECTS,
  filterChats,
  projectsOf,
  resolveProjectFilter,
  type ProjectFilter,
} from "@/interactions/chats/functions/chat-filters.functions";
import {
  setChatFilters,
  useChatFilters,
} from "@/interactions/chats/adapters/chat-filters.store";
import { DATE_FILTERS, type DateFilter } from "@/lib/date-filter";
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
   * deliberately stepped past would be the surprise. ⌘-clicking a row is how a
   * conversation is lifted into one; the toolbar's crumb is the way back.
   */
  const { tabs, activeId } = useWindowTabs();
  const startingNew = useSearch({ strict: false }).new === true;
  const ownTab =
    startingNew || tabs.find((tab) => tab.id === activeId)?.kind === "session";

  const [seenAt] = useState(prefs.inboxSeenAt);
  useEffect(() => {
    setUiPrefs({ inboxSeenAt: new Date().toISOString() });
  }, []);

  const summaries = useMemo(() => chats.data ?? [], [chats.data]);

  // Derived from the sessions themselves: a project is offered while it has
  // something to show, and the menu needs nothing fetched to draw itself.
  const projects = useMemo(() => projectsOf(summaries), [summaries]);
  const stored = useChatFilters();
  const dateFilter = stored.date;
  const projectFilter = resolveProjectFilter(projects, stored.project);
  const filtered = useMemo(
    () => filterChats(summaries, { project: projectFilter, date: dateFilter }),
    [summaries, projectFilter, dateFilter]
  );

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
  const showList = !composing && !ownTab && prefs.sidebarVisible;

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
                  {projects.length > 1 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Filter by project"
                            className={cn(
                              "relative size-6 text-muted-foreground opacity-0 transition-opacity group-hover/heading:opacity-100 focus-visible:opacity-100",
                              projectFilter !== ALL_PROJECTS && "opacity-100"
                            )}
                          />
                        }
                      >
                        <IconFolder className="size-3.5" />
                        {projectFilter !== ALL_PROJECTS && (
                          <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-brand-500" />
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-48">
                        <DropdownMenuRadioGroup
                          value={projectFilter}
                          onValueChange={(v) =>
                            setChatFilters({ project: v as ProjectFilter })
                          }
                        >
                          <DropdownMenuRadioItem value={ALL_PROJECTS}>
                            All projects
                          </DropdownMenuRadioItem>
                          {projects.map((project) => (
                            <DropdownMenuRadioItem
                              key={project.path}
                              value={project.path}
                            >
                              <span className="truncate">{project.name}</span>
                              <span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">
                                {project.count}
                              </span>
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
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
                        onValueChange={(v) =>
                          setChatFilters({ date: v as DateFilter })
                        }
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
                    No sessions match these filters.
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
        <Outlet />
      </section>
    </div>
  );
}
