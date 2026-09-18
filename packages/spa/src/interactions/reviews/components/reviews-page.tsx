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
import { IconCloud, IconGitBranch } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PaneHeader } from "@/components/layout/pane-header";
import {
  branchLabel,
  SidebarSearch,
} from "@/components/layout/sidebar-filters";
import { Button } from "@/components/ui/button";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableCellText,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { usePulls, useRepo } from "@/lib/queries";
import { errorReason } from "@/lib/errors";
import { timeAgo } from "@/lib/relative-time";
import { island } from "@/lib/shell";
import { reviewHref } from "@/lib/shell-route";
import { NoReviewRemote, NoReviews, PickReview } from "./reviews-empty";
import {
  groupReviewsByBase,
  reviewAuthor,
  reviewBranch,
  reviewItems,
  reviewKey,
  reviewTitle,
  reviewUpdatedAt,
  type ReviewItem,
} from "../functions/reviews.functions";

/**
 * The columns, written once so the header cells and the row cells stay in step.
 * Each drops out at the width where the title would start losing characters to
 * it: a review you cannot read the name of is not a list any more.
 */
const COL = {
  title: "flex-[2]",
  branch: "hidden flex-1 md:flex",
  author: "hidden w-32 flex-none lg:flex",
  updated: "hidden w-24 flex-none sm:flex",
} as const;

function ReviewsTableHead() {
  return (
    <TableHead>
      <TableCell className={COL.title}>Merge request</TableCell>
      <TableCell className={COL.branch}>Branch</TableCell>
      <TableCell className={COL.author}>Author</TableCell>
      <TableCell className={COL.updated}>Updated</TableCell>
    </TableHead>
  );
}

function Row({ item, onOpen }: { item: ReviewItem; onOpen: () => void }) {
  const updated = reviewUpdatedAt(item);
  const branch = reviewBranch(item);
  return (
    <TableRow onClick={onOpen}>
      <TableCell className={cn(COL.title, "gap-2")}>
        <IconCloud
          className="size-3.5 shrink-0 text-table-head-ink"
          aria-label="Runs in the cloud"
        />
        <span className="shrink-0 font-mono text-table-head-ink">
          #{item.pull.number}
        </span>
        <TableCellText>{reviewTitle(item)}</TableCellText>
      </TableCell>
      <TableCell className={cn(COL.branch, "font-mono text-table-head-ink")}>
        <TableCellText>
          {reviewTitle(item) === branch ? "" : branch}
        </TableCellText>
      </TableCell>
      <TableCell className={cn(COL.author, "text-table-head-ink")}>
        <TableCellText>{reviewAuthor(item)}</TableCellText>
      </TableCell>
      <TableCell className={cn(COL.updated, "text-table-head-ink")}>
        <TableCellText>
          {updated.length > 0 ? timeAgo(updated) : ""}
        </TableCellText>
      </TableCell>
    </TableRow>
  );
}

export function ReviewsPage() {
  // Inside the macOS shell the list is the sidebar's, native, reading the
  // same endpoint itself; the page is the room a picked one's diff takes.
  if (island !== undefined) return <PickReview />;
  return <ReviewsList />;
}

function ReviewsList() {
  const navigate = useNavigate();
  const repo = useRepo();
  const hasGitHub = repo.data?.github != null;
  const pulls = usePulls(hasGitHub);

  const [search, setSearch] = useState("");

  const items = useMemo(() => reviewItems(pulls.data ?? []), [pulls.data]);

  const groups = useMemo(() => {
    const q = search.trim().replace(/^#/, "").toLowerCase();
    const matching = items.filter((item) => {
      if (q.length === 0) return true;
      return `${item.pull.number}\n${reviewTitle(item)}\n${reviewAuthor(item)}\n${reviewBranch(item)}`
        .toLowerCase()
        .includes(q);
    });
    return groupReviewsByBase(matching);
  }, [items, search]);

  const open = (item: ReviewItem) =>
    void navigate({
      to: reviewHref({ kind: "pull", number: item.pull.number }),
    });

  const error = pulls.error
    ? errorReason(pulls.error, "Could not load merge requests")
    : null;
  // A query that was never enabled is pending for as long as the window is
  // open, and a list that says it is loading forever is worse than one that
  // says it is empty.
  const loading = hasGitHub && pulls.isPending;
  const hasMatches = groups.some((group) => group.items.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PaneHeader
        crumbs={[<span key="reviews">Merge requests</span>]}
        actions={
          <div className="flex w-72 items-center">
            <SidebarSearch
              label="Search merge requests"
              placeholder="Search merge requests…"
              value={search}
              onChange={setSearch}
            />
          </div>
        }
      />
      <ScrollArea className="min-h-0 flex-1" viewportClassName="px-2 py-2">
        {error !== null ? (
          <p className="px-3 py-8 text-center text-xs text-destructive">
            {error}
          </p>
        ) : loading && items.length === 0 ? (
          <div className="px-3 py-3">
            <LoadingCursor label="Loading merge requests…" />
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
              Nothing matches this search.
            </p>
            <Button size="sm" variant="ghost" onClick={() => setSearch("")}>
              Clear the search
            </Button>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.base} className="mb-4 px-1">
              <h2 className="flex items-center gap-1.5 px-4 pt-2 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <IconGitBranch className="size-3 shrink-0" />
                <span className="truncate">{branchLabel(group.base)}</span>
                <span className="ml-auto tabular-nums">
                  {group.items.length}
                </span>
              </h2>
              <Table>
                <ReviewsTableHead />
                <TableBody>
                  {group.items.map((item) => (
                    <Row
                      key={reviewKey(item)}
                      item={item}
                      onOpen={() => open(item)}
                    />
                  ))}
                </TableBody>
              </Table>
            </section>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
