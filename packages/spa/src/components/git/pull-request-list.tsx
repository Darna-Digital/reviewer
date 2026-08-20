/**
 * PullRequestList — the page review mode opens on, and the whole of it: every
 * open pull request, grouped under the branch it targets, over a free-text
 * search and a branch + time filter.
 *
 * It used to be a column beside a diff, which is why it read as a strip of
 * truncated titles — there was no room for anything else, and no room needed,
 * since the window had already opened itself on the top row. Picking is its own
 * step now, so the page is the width of the window and a row can say what the
 * pick is actually made on: who wrote it, where it is going, how big it is,
 * whether CI passed, and whether anything is in the way of merging it.
 */
import { IconGitBranch, IconGitPullRequestDraft } from "@tabler/icons-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ALL_BRANCHES,
  branchLabel,
  SidebarFilterMenu,
  SidebarSearch,
} from "@/components/layout/sidebar-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BlockedIcon, ChecksIcon } from "@/components/git/pull-request-status";
import { dateCutoff, type DateFilter } from "@/lib/date-filter";
import { timeAgo } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type {
  PullRequestInfo,
  PullRequestLabel,
} from "@byconvo/core/ports/git-provider";
import { groupPullsByBase } from "./pull-requests.functions";

interface PullRequestListProps {
  pulls: ReadonlyArray<PullRequestInfo>;
  error: string | null;
  loading?: boolean;
  onSelect: (pull: PullRequestInfo) => void;
  /** What stands in for the list when the project has no open pull requests. */
  empty?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** GitHub gives label colours as bare hex; a label with none falls back. */
const labelStyle = (color: string) =>
  /^[0-9a-fA-F]{6}$/.test(color)
    ? {
        backgroundColor: `#${color}20`,
        color: `#${color}`,
        borderColor: `#${color}55`,
      }
    : undefined;

function Labels({ labels }: { labels: ReadonlyArray<PullRequestLabel> }) {
  if (labels.length === 0) return null;
  return (
    <span className="hidden shrink-0 items-center gap-1 lg:flex">
      {labels.slice(0, 3).map((label) => (
        <Badge
          key={label.name}
          variant="outline"
          className="h-4 px-1.5 text-[10px]"
          style={labelStyle(label.color)}
        >
          {label.name}
        </Badge>
      ))}
    </span>
  );
}

export function PullRequestList({
  pulls,
  error,
  loading = false,
  onSelect,
  empty,
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

  /**
   * One row across the window. The title takes whatever is left; everything
   * that is read by scanning rather than by reading — the size of the change,
   * when it moved, CI, the blocker — is pinned to the right, so those stay in
   * their own columns down the page instead of ragging after each title.
   */
  const renderRow = (p: PullRequestInfo) => (
    <button
      key={p.number}
      type="button"
      className="mb-0.5 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted/60"
      onClick={() => onSelect(p)}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          {p.draft && (
            <IconGitPullRequestDraft
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-label="Draft"
            />
          )}
          <span className="truncate text-sm font-medium">{p.title}</span>
          <Labels labels={p.labels} />
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0 font-mono">#{p.number}</span>
          <span className="truncate">{p.author}</span>
          <span aria-hidden>·</span>
          <span className="truncate font-mono">{p.headRef}</span>
          <span aria-hidden>→</span>
          <span className="truncate font-mono">{p.baseRef}</span>
        </div>
      </div>
      {p.changedFiles > 0 && (
        <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline">
          {p.changedFiles} file{p.changedFiles === 1 ? "" : "s"}{" "}
          <span className="text-emerald-600 dark:text-emerald-400">
            +{p.additions}
          </span>{" "}
          <span className="text-destructive">−{p.deletions}</span>
        </span>
      )}
      {p.updatedAt.length > 0 && (
        <span className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground sm:inline">
          {timeAgo(p.updatedAt)}
        </span>
      )}
      <span className="flex w-10 shrink-0 items-center justify-end gap-1">
        <BlockedIcon pull={p} />
        <ChecksIcon pull={p} />
      </span>
    </button>
  );

  return (
    <section className={cn("flex min-h-0 flex-col", className)} style={style}>
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
        viewportClassName="scroll-fade px-2 py-2"
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
          (empty ?? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No open pull requests.
            </p>
          ))
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
                <div className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
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
    </section>
  );
}
