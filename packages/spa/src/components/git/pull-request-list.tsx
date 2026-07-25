/**
 * PullRequestList — the review sidebar's pull request picker. It mirrors the
 * agent-threads sidebar: a free-text search over number/title/author/branch, a
 * branch + time filter menu, and rows grouped under the branch each PR targets.
 */
import { IconGitBranch } from "@tabler/icons-react"
import { useMemo, useState, type CSSProperties } from "react"
import {
  ALL_BRANCHES,
  branchLabel,
  SidebarFilterMenu,
  SidebarSearch,
} from "@/components/layout/sidebar-filters"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { dateCutoff, type DateFilter } from "@/lib/date-filter"
import { cn } from "@/lib/utils"
import type { PullRequestInfo } from "@byconvo/core/ports/git-provider"

interface PullRequestListProps {
  pulls: ReadonlyArray<PullRequestInfo>
  error: string | null
  selectedNumber: number | null
  onSelect: (pull: PullRequestInfo) => void
  className?: string
  style?: CSSProperties
}

export function PullRequestList({
  pulls,
  error,
  selectedNumber,
  onSelect,
  className,
  style,
}: PullRequestListProps) {
  const [baseFilter, setBaseFilter] = useState(ALL_BRANCHES)
  const [dateFilter, setDateFilter] = useState<DateFilter>("all")
  const [search, setSearch] = useState("")

  const baseBranches = useMemo(
    () => [...new Set(pulls.map((p) => p.baseRef))].sort(),
    [pulls]
  )

  const filtered = useMemo(() => {
    const cutoff = dateCutoff(dateFilter)
    const q = search.trim().replace(/^#/, "").toLowerCase()
    return pulls.filter((p) => {
      if (cutoff > 0 && Date.parse(p.updatedAt) < cutoff) return false
      if (q.length > 0) {
        const haystack =
          `${p.number}\n${p.title}\n${p.author}\n${p.headRef}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [pulls, dateFilter, search])

  const groups = useMemo(() => {
    const present = [...new Set(filtered.map((p) => p.baseRef))].sort()
    const basesToShow = baseFilter === ALL_BRANCHES ? present : [baseFilter]
    return basesToShow.map((base) => ({
      base,
      pulls: filtered.filter((p) => p.baseRef === base),
    }))
  }, [filtered, baseFilter])

  const hasMatches = groups.some((g) => g.pulls.length > 0)
  const filtersActive =
    baseFilter !== ALL_BRANCHES ||
    dateFilter !== "all" ||
    search.trim().length > 0

  const renderRow = (p: PullRequestInfo) => (
    <button
      key={p.number}
      type="button"
      className={cn(
        "mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/60",
        p.number === selectedNumber && "bg-muted"
      )}
      aria-current={p.number === selectedNumber ? "true" : undefined}
      onClick={() => onSelect(p)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            #{p.number}
          </span>
          <span className="truncate text-sm">{p.title}</span>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {p.author} · {p.headRef}
        </div>
      </div>
    </button>
  )

  return (
    <aside className={cn("flex min-h-0 flex-col", className)} style={style}>
      <div className="flex items-center gap-1.5 border-b p-2">
        <SidebarSearch
          label="Search pull requests"
          placeholder="Search pull requests…"
          value={search}
          onChange={setSearch}
        />
        <SidebarFilterMenu
          label="Filter pull requests"
          branchValue={baseFilter}
          branches={baseBranches}
          onBranchChange={setBaseFilter}
          dateValue={dateFilter}
          onDateChange={setDateFilter}
          active={filtersActive}
        />
      </div>
      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="scroll-fade px-1 py-2"
      >
        {error !== null ? (
          <p className="px-3 py-6 text-center text-xs text-destructive">
            {error}
          </p>
        ) : pulls.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No open pull requests.
          </p>
        ) : !hasMatches ? (
          <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
            <p className="text-xs text-muted-foreground">
              No pull requests match these filters.
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setBaseFilter(ALL_BRANCHES)
                setDateFilter("all")
                setSearch("")
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : baseFilter === ALL_BRANCHES ? (
          // Grouped under the target branch when viewing all branches.
          groups
            .filter((g) => g.pulls.length > 0)
            .map((group) => (
              <div key={group.base} className="mb-1">
                <div className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  <IconGitBranch className="size-3 shrink-0" />
                  <span className="truncate">{branchLabel(group.base)}</span>
                  <span className="ml-auto tabular-nums">
                    {group.pulls.length}
                  </span>
                </div>
                {group.pulls.map(renderRow)}
              </div>
            ))
        ) : (
          groups[0]?.pulls.map(renderRow)
        )}
      </ScrollArea>
    </aside>
  )
}
