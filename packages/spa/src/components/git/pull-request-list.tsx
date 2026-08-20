/**
 * PullRequestList — the review sidebar's pull request picker. It mirrors the
 * agent-threads sidebar: a free-text search over number/title/author/branch, a
 * branch + time filter menu, and rows grouped under the branch each PR targets.
 *
 * It is the window's first column and runs its full height, so a row is the
 * only place a reviewer sees the whole list at once. That is why each row also
 * carries CI and whether the pull request is blocked: the decision of which one
 * to open is made here, and it is made on those two things more than on titles.
 */
import { IconGitBranch, IconGitPullRequestDraft } from "@tabler/icons-react";
import { useMemo, useState, type CSSProperties } from "react";
import {
  ALL_BRANCHES,
  branchLabel,
  SidebarFilterMenu,
  SidebarSearch,
} from "@/components/layout/sidebar-filters";
import { Button } from "@/components/ui/button";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { dateCutoff, type DateFilter } from "@/lib/date-filter";
import { cn } from "@/lib/utils";
import type { PullRequestInfo } from "@byconvo/core/ports/git-provider";
import { BlockedIcon, ChecksIcon } from "@/components/git/pull-request-status";
import { groupPullsByBase } from "./pull-requests.functions";

interface PullRequestListProps {
  pulls: ReadonlyArray<PullRequestInfo>;
  error: string | null;
  loading?: boolean;
  selectedNumber: number | null;
  onSelect: (pull: PullRequestInfo) => void;
  className?: string;
  style?: CSSProperties;
}

export function PullRequestList({
  pulls,
  error,
  loading = false,
  selectedNumber,
  onSelect,
  className,
  style,
}: PullRequestListProps) {
  const [baseFilter, setBaseFilter] = useState(ALL_BRANCHES);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [search, setSearch] = useState("");

  const baseBranches = useMemo(
    () => [...new Set(pulls.map((p) => p.baseRef))].sort(),
    [pulls]
  );

  const filtered = useMemo(() => {
    const cutoff = dateCutoff(dateFilter);
    const q = search.trim().replace(/^#/, "").toLowerCase();
    return pulls.filter((p) => {
      if (cutoff > 0 && Date.parse(p.updatedAt) < cutoff) return false;
      if (q.length > 0) {
        const haystack =
          `${p.number}\n${p.title}\n${p.author}\n${p.headRef}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [pulls, dateFilter, search]);

  const groups = useMemo(() => {
    const grouped = groupPullsByBase(filtered);
    return baseFilter === ALL_BRANCHES
      ? grouped
      : grouped.filter((group) => group.base === baseFilter);
  }, [filtered, baseFilter]);

  const hasMatches = groups.some((g) => g.pulls.length > 0);
  const filtersActive =
    baseFilter !== ALL_BRANCHES ||
    dateFilter !== "all" ||
    search.trim().length > 0;

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
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            #{p.number}
          </span>
          <span className="truncate text-sm">{p.title}</span>
          {/* Pinned to the right of the row rather than beside the title: the
              glyphs stay in one column down the list, so the failing one is
              found by scanning rather than by reading every title. */}
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {p.draft && (
              <IconGitPullRequestDraft
                className="size-3.5 text-muted-foreground"
                aria-label="Draft"
              />
            )}
            <BlockedIcon pull={p} />
            <ChecksIcon pull={p} />
          </span>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {p.author} · {p.headRef}
        </div>
      </div>
    </button>
  );

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
        ) : loading ? (
          <div className="px-3 py-2">
            <LoadingCursor label="Loading pull requests…" />
          </div>
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
                setBaseFilter(ALL_BRANCHES);
                setDateFilter("all");
                setSearch("");
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
  );
}
