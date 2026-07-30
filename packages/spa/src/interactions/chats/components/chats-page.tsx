/**
 * ChatsPage — the /chats layout: a resizable sidebar listing the repo's agent
 * chats beside the routed content (the new-thread composer on the index, a
 * conversation on /chats/$chatId).
 *
 * The sidebar filters the list by branch (grouped like the terminal threads,
 * defaulting to the current checkout), a time window, and a free-text search
 * over titles and last messages.
 */
import { IconGitBranch, IconPlus } from "@tabler/icons-react"
import { Outlet, useNavigate, useParams } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ResizeHandle } from "@/components/layout/resize-handle"
import { SidebarNav } from "@/components/layout/sidebar-nav"
import {
  ALL_BRANCHES,
  branchLabel,
  SidebarFilterMenu,
  SidebarSearch,
} from "@/components/layout/sidebar-filters"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter"
import { ChatRow } from "@/interactions/chats/components/chat-row"
import type { ChatSummary } from "@byconvo/core/chats"
import { dateCutoff, type DateFilter } from "@/lib/date-filter"
import { useBranches, useChats, useRepo } from "@/lib/queries"
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs"

export function ChatsPage() {
  const chats = useChats()
  const actions = useChatsActions()
  const navigate = useNavigate()
  const { chatId } = useParams({ strict: false })
  const prefs = useUiPrefs()
  const [sidebarWidth, setSidebarWidth] = useState(prefs.workspaceSidebarWidth)

  const repo = useRepo()
  const branchesQuery = useBranches()
  const currentBranch = repo.data?.currentBranch ?? ""
  const localBranches = useMemo(
    () => (branchesQuery.data ?? []).map((b) => b.name),
    [branchesQuery.data]
  )

  const summaries = useMemo(() => chats.data ?? [], [chats.data])

  // Branch the sidebar is filtered to (null → follow the current branch).
  const [branchFilter, setBranchFilter] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>("all")
  const [search, setSearch] = useState("")
  const activeBranch = branchFilter ?? (currentBranch || ALL_BRANCHES)

  // Branches offered in the filter: current + local + any a chat already uses.
  const filterBranches = useMemo(() => {
    const set = new Set<string>()
    if (currentBranch) set.add(currentBranch)
    localBranches.forEach((b) => set.add(b))
    summaries.forEach((c) => c.branch && set.add(c.branch))
    return [...set].sort((a, b) =>
      a === currentBranch ? -1 : b === currentBranch ? 1 : a.localeCompare(b)
    )
  }, [currentBranch, localBranches, summaries])

  // Chats surviving the date + search filters (branch is applied via grouping).
  const filtered = useMemo(() => {
    const cutoff = dateCutoff(dateFilter)
    const q = search.trim().toLowerCase()
    return summaries.filter((c) => {
      if (cutoff > 0 && Date.parse(c.updatedAt) < cutoff) return false
      if (q.length > 0) {
        const haystack = `${c.title}\n${c.lastMessage ?? ""}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [summaries, dateFilter, search])

  // Chats grouped under their branch, in the same order as the filter.
  const groups = useMemo(() => {
    const present = [...new Set(filtered.map((c) => c.branch))].sort((a, b) =>
      a === currentBranch ? -1 : b === currentBranch ? 1 : a.localeCompare(b)
    )
    const branchesToShow =
      activeBranch === ALL_BRANCHES ? present : [activeBranch]
    return branchesToShow.map((branch) => ({
      branch,
      chats: filtered.filter((c) => c.branch === branch),
    }))
  }, [filtered, activeBranch, currentBranch])

  const hasMatches = groups.some((g) => g.chats.length > 0)
  const filtersActive =
    activeBranch !== ALL_BRANCHES ||
    dateFilter !== "all" ||
    search.trim().length > 0

  const remove = async (id: string) => {
    try {
      await actions.remove(id)
      if (id === chatId) void navigate({ to: "/chats" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "delete failed")
    }
  }

  const renderRow = (c: ChatSummary) => (
    <ChatRow
      key={c.id}
      chat={c}
      active={c.id === chatId}
      onDelete={() => void remove(c.id)}
    />
  )

  return (
    <div className="flex h-full min-h-0">
      <aside
        className="flex shrink-0 flex-col border-r"
        style={{ width: sidebarWidth }}
      >
        <SidebarNav className="shrink-0 border-b" />
        <div className="flex items-center gap-1.5 border-b p-2">
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
              void navigate({ to: "/chats", search: { new: true } })
            }
          >
            <IconPlus className="size-4" />
          </Button>
        </div>
        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="scroll-fade overflow-x-hidden px-1 py-2"
        >
          {summaries.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No threads yet. Send a message to start one.
            </p>
          ) : !hasMatches ? (
            <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                No threads match these filters.
              </p>
              {filtersActive && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setBranchFilter(ALL_BRANCHES)
                    setDateFilter("all")
                    setSearch("")
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
                <div key={group.branch} className="mb-1">
                  <div className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
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
      <ResizeHandle
        orientation="col"
        value={sidebarWidth}
        min={180}
        max={() => Math.max(240, window.innerWidth - 480)}
        onResize={setSidebarWidth}
        onResizeEnd={(w) => setUiPrefs({ workspaceSidebarWidth: w })}
        label="Resize sidebar"
      />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </section>
    </div>
  )
}
