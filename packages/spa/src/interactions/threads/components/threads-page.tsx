/**
 * ThreadsPage — terminal threads. A Threads Sidebar on the left lists
 * every repo-scoped terminal (plain shell or an agent CLI); the panel body on
 * the right shows the one selected thread's live terminal with a toolbar
 * (title + rename).
 *
 * The sidebar filters the list by branch (grouped like agent chats, defaulting
 * to the current checkout), a time window, and a free-text search over titles
 * and last commands. Backgrounded terminals keep running: every visited
 * thread's terminal stays mounted (just hidden) so its PTY session survives
 * switching, and a hidden terminal that emits a bell shows an activity dot.
 */
import {
  IconGitBranch,
  IconPencil,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarResizeHandle } from "@/components/layout/sidebar-resize-handle";
import {
  ALL_BRANCHES,
  branchLabel,
  SidebarFilterMenu,
  SidebarSearch,
} from "@/components/layout/sidebar-filters";
import { agentIcon } from "@/interactions/threads/components/agent-icons";
import {
  Terminal,
  disposeLiveTerminal,
} from "@/interactions/threads/components/terminal";
import { useThreadsActions } from "@/interactions/threads/adapters/threads.hook.adapter";
import { AGENTS, agentLabel } from "@/interactions/threads/interfaces/agents";
import type { AgentKind, ThreadSummary } from "@byconvo/core/threads";
import { dateCutoff, type DateFilter } from "@/lib/date-filter";
import { useBranches, useRepo, useThreads } from "@/lib/queries";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

function NewTerminalMenu({
  onPick,
  trigger,
}: {
  onPick: (agent: AgentKind) => void;
  trigger: React.ReactElement;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align="end" className="w-auto min-w-56">
        {AGENTS.map((agent) => {
          const Icon = agentIcon(agent.kind);
          return (
            <DropdownMenuItem
              key={agent.kind}
              onClick={() => onPick(agent.kind)}
              className="gap-3 whitespace-nowrap"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">{agent.label}</span>
              <span className="ml-auto pl-4 text-xs text-muted-foreground">
                {agent.hint}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThreadsPage() {
  const threads = useThreads();
  const actions = useThreadsActions();
  const prefs = useUiPrefs();

  const repo = useRepo();
  const branchesQuery = useBranches();

  const summaries = useMemo(() => threads.data ?? [], [threads.data]);
  const currentBranch = repo.data?.currentBranch ?? "";
  const localBranches = useMemo(
    () => (branchesQuery.data ?? []).map((b) => b.name),
    [branchesQuery.data]
  );

  const [sidebarWidth, setSidebarWidth] = useState(prefs.workspaceSidebarWidth);
  // Branch the sidebar is filtered to (null → follow the current branch).
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [search, setSearch] = useState("");
  const activeBranch = branchFilter ?? (currentBranch || ALL_BRANCHES);
  // New threads land in the filtered branch (or the current branch under "All").
  const newThreadBranch =
    activeBranch === ALL_BRANCHES ? currentBranch : activeBranch;

  // Branches offered in the filter: current + local + any a thread already uses.
  const filterBranches = useMemo(() => {
    const set = new Set<string>();
    if (currentBranch) set.add(currentBranch);
    localBranches.forEach((b) => set.add(b));
    summaries.forEach((t) => t.branch && set.add(t.branch));
    return [...set].sort((a, b) =>
      a === currentBranch ? -1 : b === currentBranch ? 1 : a.localeCompare(b)
    );
  }, [currentBranch, localBranches, summaries]);

  // Threads surviving the date + search filters (branch is applied via grouping).
  const filtered = useMemo(() => {
    const cutoff = dateCutoff(dateFilter);
    const q = search.trim().toLowerCase();
    return summaries.filter((t) => {
      if (cutoff > 0 && Date.parse(t.updatedAt) < cutoff) return false;
      if (q.length > 0) {
        const haystack =
          `${t.title}\n${t.lastCommand ?? ""}\n${agentLabel(t.agent)}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [summaries, dateFilter, search]);

  // Threads grouped under their branch, in the same order as the filter.
  const groups = useMemo(() => {
    const present = [...new Set(filtered.map((t) => t.branch))].sort((a, b) =>
      a === currentBranch ? -1 : b === currentBranch ? 1 : a.localeCompare(b)
    );
    const branchesToShow =
      activeBranch === ALL_BRANCHES ? present : [activeBranch];
    return branchesToShow.map((branch) => ({
      branch,
      threads: filtered.filter((t) => t.branch === branch),
    }));
  }, [filtered, activeBranch, currentBranch]);

  const hasMatches = groups.some((g) => g.threads.length > 0);
  const filtersActive =
    activeBranch !== ALL_BRANCHES ||
    dateFilter !== "all" ||
    search.trim().length > 0;

  const [activeId, setActiveId] = useState<string | null>(null);
  // Threads whose terminal has been mounted (and kept alive) — we never
  // unmount a visited terminal so it keeps running in the background.
  const [mountedIds, setMountedIds] = useState<ReadonlyArray<string>>([]);
  const [liveTitles, setLiveTitles] = useState<Record<string, string>>({});
  const [activity, setActivity] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<{
    id: string;
    draft: string;
  } | null>(null);

  // Keep a valid selection as the list loads/changes.
  useEffect(() => {
    if (summaries.length === 0) setActiveId(null);
    else if (!summaries.some((t) => t.id === activeId))
      setActiveId(summaries[0].id);
  }, [summaries, activeId]);

  // Mount the focused thread (and keep it mounted) + clear its activity.
  useEffect(() => {
    if (activeId === null) return;
    setMountedIds((ids) => (ids.includes(activeId) ? ids : [...ids, activeId]));
    setActivity((a) => (a[activeId] ? { ...a, [activeId]: false } : a));
  }, [activeId]);

  const active = summaries.find((t) => t.id === activeId) ?? null;
  const ActiveIcon = agentIcon(active?.agent ?? "terminal");

  const createThread = async (agent: AgentKind) => {
    try {
      const created = await actions.create(agent, "", null, newThreadBranch);
      setActiveId(created.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not create thread"
      );
    }
  };

  const closeThread = async (id: string) => {
    setMountedIds((ids) => ids.filter((m) => m !== id));
    if (activeId === id) {
      const next = summaries.find((t) => t.id !== id);
      setActiveId(next?.id ?? null);
    }
    await actions.remove(id);
    // Tear down the persistent client-side session (the server kills the PTY).
    disposeLiveTerminal(id);
  };

  const commitRename = async () => {
    if (renaming === null) return;
    const { id, draft } = renaming;
    setRenaming(null);
    if (draft.trim().length > 0) await actions.rename(id, draft);
  };

  // Subtitle for a sidebar row: the live process title, else last command/agent.
  const subtitleOf = (t: ThreadSummary) =>
    liveTitles[t.id] ?? t.lastCommand ?? agentLabel(t.agent);

  const renderRow = (t: ThreadSummary) => {
    const Icon = agentIcon(t.agent);
    return (
      <div
        key={t.id}
        className={cn(
          "group/row mb-0.5 flex min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-sm hover:bg-muted",
          t.id === activeId && "bg-muted"
        )}
        onClick={() => setActiveId(t.id)}
        onDoubleClick={() => setRenaming({ id: t.id, draft: t.title })}
        title="Double-click to rename"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        {renaming?.id === t.id ? (
          <Input
            autoFocus
            value={renaming.draft}
            className="h-6 min-w-0 flex-1"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRenaming({ id: t.id, draft: e.target.value })}
            onBlur={() => void commitRename()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commitRename();
              } else if (e.key === "Escape") setRenaming(null);
            }}
          />
        ) : (
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="truncate font-medium">{t.title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {subtitleOf(t)}
            </div>
          </div>
        )}
        {activity[t.id] && t.id !== activeId && (
          <span
            className="size-1.5 shrink-0 rounded-full bg-brand-500"
            aria-label="activity"
          />
        )}
        {t.taskKey !== null && (
          <span className="shrink-0 rounded bg-muted-foreground/15 px-1 text-[10px] text-muted-foreground">
            {t.taskKey}
          </span>
        )}
        <button
          type="button"
          aria-label="Close terminal"
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            void closeThread(t.id);
          }}
        >
          <IconX className="size-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Threads sidebar (drag-resizable) */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r",
          !prefs.sidebarVisible && "hidden"
        )}
        style={{ width: sidebarWidth }}
      >
        <div className="flex items-center gap-1.5 border-b p-2">
          <SidebarSearch
            label="Search terminals"
            placeholder="Search terminals…"
            value={search}
            onChange={setSearch}
          />
          {/* Filters — branch (groups threads, defaulting to the current
              checkout; new terminals land in the selected branch) and time
              window, combined behind one dropdown. */}
          <SidebarFilterMenu
            label="Filter terminals"
            branchValue={activeBranch}
            branches={filterBranches}
            onBranchChange={setBranchFilter}
            dateValue={dateFilter}
            onDateChange={setDateFilter}
            active={filtersActive}
          />
          <NewTerminalMenu
            onPick={(a) => void createThread(a)}
            trigger={
              <Button
                size="icon"
                variant="ghost"
                className="size-7 shrink-0"
                aria-label="New terminal"
              >
                <IconPlus className="size-4" />
              </Button>
            }
          />
        </div>
        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="scroll-fade overflow-x-hidden px-1 py-2"
        >
          {summaries.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No terminals yet. Start one from the + menu.
            </p>
          ) : !hasMatches ? (
            <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                No terminals match these filters.
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
              .filter((g) => g.threads.length > 0)
              .map((group) => (
                <div key={group.branch} className="mb-1">
                  <div className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    <IconGitBranch className="size-3 shrink-0" />
                    <span className="truncate">
                      {branchLabel(group.branch)}
                    </span>
                    <span className="ml-auto tabular-nums">
                      {group.threads.length}
                    </span>
                  </div>
                  {group.threads.map(renderRow)}
                </div>
              ))
          ) : (
            // A single branch is selected — the filter is the header.
            groups[0]?.threads.map(renderRow)
          )}
        </ScrollArea>
      </aside>
      {prefs.sidebarVisible && (
        <SidebarResizeHandle
          width={sidebarWidth}
          stored={prefs.workspaceSidebarWidth}
          max={() => Math.max(240, window.innerWidth - 480)}
          onResize={setSidebarWidth}
          onResizeEnd={(w) => setUiPrefs({ workspaceSidebarWidth: w })}
        />
      )}

      {/* Panel body — single active terminal */}
      <section className="flex min-w-0 flex-1 flex-col">
        {active === null ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm">
            <div className="font-medium">No terminal open</div>
            <div className="text-muted-foreground">
              Start a terminal, Claude Code, opencode, or Codex thread.
            </div>
            <NewTerminalMenu
              onPick={(a) => void createThread(a)}
              trigger={
                <Button size="sm" variant="outline" className="mt-1">
                  <IconPlus className="size-4" /> New terminal
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b px-3 py-1.5">
              <ActiveIcon className="size-4 shrink-0 text-muted-foreground" />
              {renaming?.id === active.id ? (
                <Input
                  autoFocus
                  value={renaming.draft}
                  className="h-7 max-w-64"
                  onChange={(e) =>
                    setRenaming({ id: active.id, draft: e.target.value })
                  }
                  onBlur={() => void commitRename()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitRename();
                    } else if (e.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="group/title flex min-w-0 items-center gap-1.5"
                  onClick={() =>
                    setRenaming({ id: active.id, draft: active.title })
                  }
                >
                  <span className="truncate text-sm font-medium">
                    {active.title}
                  </span>
                  {liveTitles[active.id] && (
                    <span className="truncate text-xs text-muted-foreground">
                      — {liveTitles[active.id]}
                    </span>
                  )}
                  <IconPencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover/title:opacity-100" />
                </button>
              )}
            </header>

            {/* Every visited terminal stays mounted; only the active one shows. */}
            <div className="relative min-h-0 flex-1 bg-background">
              {summaries
                .filter((t) => mountedIds.includes(t.id))
                .map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "absolute inset-0 p-1",
                      t.id === activeId ? "block" : "hidden"
                    )}
                  >
                    <Terminal
                      id={t.id}
                      agent={t.agent}
                      active={t.id === activeId}
                      resolvedTheme={prefs.resolvedTheme}
                      onTitle={(title) =>
                        setLiveTitles((m) =>
                          m[t.id] === title ? m : { ...m, [t.id]: title }
                        )
                      }
                      onBell={() =>
                        setActivity((a) =>
                          t.id === activeId ? a : { ...a, [t.id]: true }
                        )
                      }
                    />
                  </div>
                ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
