/**
 * Everything waiting to be read, with the window to itself.
 *
 * It used to be a column beside the diff, which made it a permanent tax on the
 * width of the thing you came to read and left it too narrow to say much per
 * row. A page is the other trade: it is not on screen while you read, and in
 * exchange a row can carry the branch, the author, the state and how long it
 * has sat there. Picking one leaves for the diff view, which is where reading
 * happens for every source — the changes in this checkout included, which is
 * why the way to those is on this page too.
 */
import {
  IconCheck,
  IconCloud,
  IconDeviceLaptop,
  IconGitBranch,
  IconGitCommit,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PaneHeader } from "@/components/layout/pane-header";
import { SidebarSearch } from "@/components/layout/sidebar-filters";
import { Button } from "@/components/ui/button";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsSubtle, TabsSubtleItem } from "@/components/ui/tabs-subtle";
import { useLocalTasks, usePulls, useRepo } from "@/lib/queries";
import { errorReason } from "@/lib/errors";
import { timeAgo } from "@/lib/relative-time";
import { REVIEW_HREF, reviewHref } from "@/lib/shell-route";
import { NoReviewRemote, NoReviews } from "./reviews-empty";
import {
  filterReviewKind,
  groupReviewsByBase,
  reviewAuthor,
  reviewBranch,
  reviewFilterCount,
  reviewItems,
  reviewKey,
  reviewTitle,
  reviewUpdatedAt,
  REVIEW_FILTERS,
  REVIEW_FILTER_LABEL,
  worktreeState,
  WORKTREE_STATE_LABEL,
  type ReviewFilter,
  type ReviewItem,
} from "../functions/reviews.functions";

/** Only the states worth interrupting the row for; "ready" needs no warning. */
const STATE_TONE: Readonly<Record<string, string>> = {
  working: "text-muted-foreground",
  behind: "text-amber-600 dark:text-amber-400",
  uncommitted: "text-amber-600 dark:text-amber-400",
  ready: "text-emerald-600 dark:text-emerald-400",
};

const FILTER_ICON: Readonly<Record<ReviewFilter, typeof IconCheck>> = {
  all: IconCheck,
  worktree: IconDeviceLaptop,
  pull: IconCloud,
};

function Row({ item, onOpen }: { item: ReviewItem; onOpen: () => void }) {
  const worktree = item.kind === "worktree" ? item.worktree : null;
  const state = worktree === null ? null : worktreeState(worktree);
  const updated = reviewUpdatedAt(item);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted/60"
    >
      {item.kind === "pull" ? (
        <IconCloud
          className="size-4 shrink-0 text-muted-foreground"
          aria-label="Runs in the cloud"
        />
      ) : (
        <IconDeviceLaptop
          className="size-4 shrink-0 text-muted-foreground"
          aria-label="Runs on this machine"
        />
      )}
      <span className="flex min-w-0 flex-[2] items-baseline gap-2">
        {item.kind === "pull" && (
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            #{item.pull.number}
          </span>
        )}
        <span className="truncate text-sm">{reviewTitle(item)}</span>
      </span>
      {/* A worktree with nothing committed is titled by its branch, so
          repeating the branch would print the same word twice. */}
      <span className="hidden min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground md:block">
        {reviewTitle(item) === reviewBranch(item) ? "" : reviewBranch(item)}
      </span>
      <span className="hidden w-32 shrink-0 truncate text-xs text-muted-foreground lg:block">
        {reviewAuthor(item)}
      </span>
      <span className="hidden w-24 shrink-0 truncate text-xs text-muted-foreground sm:block">
        {updated.length > 0 ? timeAgo(updated) : ""}
      </span>
      <span className="w-40 shrink-0 truncate text-right text-xs">
        {state !== null && (
          <span className={STATE_TONE[state]}>
            {state === "ready" && worktree !== null
              ? `${worktree.ahead} to merge`
              : WORKTREE_STATE_LABEL[state]}
          </span>
        )}
      </span>
    </button>
  );
}

export function ReviewsPage() {
  const navigate = useNavigate();
  const repo = useRepo();
  const worktrees = useLocalTasks();
  const hasGitHub = repo.data?.github != null;
  const pulls = usePulls(hasGitHub);

  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [search, setSearch] = useState("");

  const items = useMemo(
    () => reviewItems(pulls.data ?? [], worktrees.data ?? []),
    [pulls.data, worktrees.data]
  );

  const groups = useMemo(() => {
    const q = search.trim().replace(/^#/, "").toLowerCase();
    const matching = filterReviewKind(items, filter).filter((item) => {
      if (q.length === 0) return true;
      const number = item.kind === "pull" ? item.pull.number : "";
      return `${number}\n${reviewTitle(item)}\n${reviewAuthor(item)}\n${reviewBranch(item)}`
        .toLowerCase()
        .includes(q);
    });
    return groupReviewsByBase(matching);
  }, [items, filter, search]);

  const open = (item: ReviewItem) =>
    void navigate({
      to:
        item.kind === "pull"
          ? reviewHref({ kind: "pull", number: item.pull.number })
          : reviewHref({ kind: "worktree", branch: item.worktree.branch }),
    });

  const error = pulls.error
    ? errorReason(pulls.error, "Could not load pull requests")
    : null;
  // A query that was never enabled is pending for as long as the window is
  // open, and a list that says it is loading forever is worse than one that
  // says it is empty.
  const loading = (hasGitHub && pulls.isPending) || worktrees.isPending;
  const hasMatches = groups.some((group) => group.items.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PaneHeader
        crumbs={[<span key="reviews">Reviews</span>]}
        actions={
          <div className="flex w-72 items-center">
            <SidebarSearch
              label="Search reviews"
              placeholder="Search reviews…"
              value={search}
              onChange={setSearch}
            />
          </div>
        }
      />
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
        <TabsSubtle
          idPrefix="reviews-filter"
          selectedIndex={REVIEW_FILTERS.indexOf(filter)}
          onSelect={(index) => {
            const next = REVIEW_FILTERS[index];
            if (next !== undefined) setFilter(next);
          }}
        >
          {REVIEW_FILTERS.map((kind, index) => (
            <TabsSubtleItem
              key={kind}
              index={index}
              label={`${REVIEW_FILTER_LABEL[kind]} ${reviewFilterCount(items, kind)}`}
              icon={FILTER_ICON[kind]}
            />
          ))}
        </TabsSubtle>
        {/* The changes in front of you are read in the same view as everything
            below, so the way to them belongs on the same page — but they are
            not waiting on anybody, which is why they are not a row in the
            list. */}
        <Button
          variant="ghost"
          size="xs"
          className="ml-auto"
          onClick={() => void navigate({ to: REVIEW_HREF })}
        >
          <IconGitCommit /> Review this checkout
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="px-2 py-2">
        {error !== null ? (
          <p className="px-3 py-8 text-center text-xs text-destructive">
            {error}
          </p>
        ) : loading && items.length === 0 ? (
          <div className="px-3 py-3">
            <LoadingCursor label="Loading reviews…" />
          </div>
        ) : items.length === 0 ? (
          hasGitHub ? (
            <NoReviews />
          ) : (
            <NoReviewRemote />
          )
        ) : !hasMatches ? (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing matches this filter.
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilter("all");
                setSearch("");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.base} className="mb-3">
              <h2 className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <IconGitBranch className="size-3 shrink-0" />
                <span className="truncate">{group.base}</span>
                <span className="ml-auto tabular-nums">
                  {group.items.length}
                </span>
              </h2>
              {group.items.map((item) => (
                <Row
                  key={reviewKey(item)}
                  item={item}
                  onOpen={() => open(item)}
                />
              ))}
            </section>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
