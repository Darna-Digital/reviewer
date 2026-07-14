/**
 * ChatsPage — the /chats layout: a resizable sidebar listing the repo's agent
 * chats beside the routed content (the new-thread composer on the index, a
 * conversation on /chats/$chatId).
 *
 * The sidebar filters the list by branch (grouped like the terminal threads,
 * defaulting to the current checkout), a time window, and a free-text search
 * over titles and last messages.
 */
import {
  IconCalendar,
  IconCheck,
  IconGitBranch,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react"
import { Link, Outlet, useNavigate, useParams } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ResizeHandle } from "@/components/layout/ResizeHandle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useChatsActions } from "@/features/chats/adapters/chats.hook.adapter"
import type { ChatSummary } from "@/lib/api/types"
import { useBranches, useChats, useRepo } from "@/lib/queries"
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs"
import { cn } from "@/lib/utils"

const ALL_BRANCHES = "__all__"

/** Display label for a chat's branch ("" → unscoped chats). */
const branchLabel = (branch: string) =>
  branch.length > 0 ? branch : "No branch"

/** Time-window filter options, applied against a chat's `updatedAt`. */
const DATE_FILTERS = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Past 7 days" },
  { value: "30d", label: "Past 30 days" },
] as const
type DateFilter = (typeof DATE_FILTERS)[number]["value"]

/** Epoch cutoff for a window; chats updated before it are hidden (0 → all). */
const dateCutoff = (filter: DateFilter): number => {
  const day = 86_400_000
  switch (filter) {
    case "today": {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      return start.getTime()
    }
    case "7d":
      return Date.now() - 7 * day
    case "30d":
      return Date.now() - 30 * day
    default:
      return 0
  }
}

/**
 * A square icon button that opens a searchable branch list. Kept as a popover
 * (not a menu) so the filter input can live above the options without the
 * menu's typeahead swallowing keystrokes.
 */
function BranchPicker({
  value,
  branches,
  onChange,
}: {
  value: string
  branches: ReadonlyArray<string>
  onChange: (branch: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const options = [ALL_BRANCHES, ...branches]
  const shown = options.filter((b) => {
    const label = b === ALL_BRANCHES ? "all branches" : b.toLowerCase()
    return label.includes(q)
  })

  const pick = (branch: string) => {
    onChange(branch)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <PopoverTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            className="size-7 shrink-0"
            aria-label={`Filter by branch: ${
              value === ALL_BRANCHES ? "all branches" : branchLabel(value)
            }`}
          >
            <IconGitBranch className="size-4" />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-56 gap-2 rounded-xl p-2">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            aria-label="Search branches"
            placeholder="Search branches…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-7 rounded-md pl-8"
          />
        </div>
        <div className="flex max-h-56 flex-col overflow-y-auto">
          {shown.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No branches match.
            </p>
          ) : (
            shown.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => pick(b)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <IconCheck
                  className={cn(
                    "size-4 shrink-0",
                    b === value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="truncate">
                  {b === ALL_BRANCHES ? "All branches" : branchLabel(b)}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TurnStateDot({ state }: { state: ChatSummary["turnState"] }) {
  if (state === null || state === "completed") return null
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        state === "running" && "animate-pulse bg-primary",
        state === "error" && "bg-destructive",
        state === "interrupted" && "bg-muted-foreground"
      )}
      aria-label={`turn ${state}`}
    />
  )
}

export function ChatsPage() {
  const chats = useChats()
  const actions = useChatsActions()
  const navigate = useNavigate()
  const { chatId } = useParams({ strict: false })
  const [sidebarWidth, setSidebarWidth] = useState(
    useUiPrefs().workspaceSidebarWidth
  )

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
    <Link
      key={c.id}
      to="/chats/$chatId"
      params={{ chatId: c.id }}
      className={cn(
        "group/row mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/60",
        c.id === chatId && "bg-muted"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <TurnStateDot state={c.turnState} />
          <span className="truncate text-sm">{c.title}</span>
        </div>
        {c.lastMessage !== null && c.lastMessage.length > 0 && (
          <div className="truncate text-xs text-muted-foreground">
            {c.lastMessage}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="Delete thread"
        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-destructive"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void remove(c.id)
        }}
      >
        <IconX className="size-3.5" />
      </button>
    </Link>
  )

  return (
    <div className="flex h-full min-h-0">
      <aside
        className="flex shrink-0 flex-col border-r"
        style={{ width: sidebarWidth }}
      >
        <div className="flex items-center gap-1.5 border-b p-2">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search threads"
              placeholder="Search threads…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 rounded-md pr-7 pl-8"
            />
            {search.length > 0 && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
              >
                <IconX className="size-3.5" />
              </button>
            )}
          </div>
          {/* Branch filter — groups chats by branch, defaulting to the current
              checkout; searchable when there are many branches. */}
          <BranchPicker
            value={activeBranch}
            branches={filterBranches}
            onChange={setBranchFilter}
          />
          {/* Time-window filter, applied against each chat's last activity. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  aria-label={`Filter by date: ${
                    DATE_FILTERS.find((d) => d.value === dateFilter)?.label
                  }`}
                >
                  <IconCalendar className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-auto min-w-40">
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
        <div className="min-h-0 flex-1 overflow-auto px-1 py-2">
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
        </div>
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
      <section className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </section>
    </div>
  )
}
