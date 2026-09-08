/**
 * What the local diff is read against, said out loud on the header row and
 * changed from there.
 *
 * Reading your own work is always a comparison — the branch as it is committed,
 * against the branch as it sits on disk — but with nothing to change it that
 * went unsaid, and the only way to read a branch against another one was a
 * crumb that appeared once something had already been chosen. So the question
 * that could not be asked was the ordinary one: how does this branch differ
 * from `main`, before there is a pull request to ask it for me.
 *
 * It sits between the branch picker and the diff-layout toggle because it is
 * the sentence between them: which branch you are on, what its changes are read
 * against, how they are laid out.
 */
import {
  IconChevronDown,
  IconCheck,
  IconGitBranch,
  IconGitCompare,
  IconPencil,
  IconWorld,
} from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MenuSearch } from "@/components/ui/menu-search";
import { cn } from "@/lib/utils";
import {
  comparisonCandidates,
  comparisonLabels,
  isComparing,
  noCandidates,
  type ComparisonCandidate,
  type LocalComparison,
} from "@reviewer/core/comparison";

export interface ComparePickerProps {
  /** What the diff is read against right now. */
  comparison: LocalComparison;
  /** The branch the work is on. */
  branch: string | null;
  /** Where this branch's work is aimed, when it has been aimed anywhere. */
  aim: string | null;
  branches: ReadonlyArray<string>;
  remoteBranches: ReadonlyArray<string>;
  /** Null means "stop comparing" — read only what is uncommitted. */
  onSelect: (ref: string | null) => void;
}

const CheckMark = ({ on }: { on: boolean }) => (
  <IconCheck
    className={cn("size-4 shrink-0", on ? "opacity-100" : "opacity-0")}
  />
);

const CandidateRow = ({
  candidate,
  comparison,
  onSelect,
}: {
  candidate: ComparisonCandidate;
  comparison: LocalComparison;
  onSelect: (ref: string) => void;
}) => (
  <DropdownMenuItem onClick={() => onSelect(candidate.ref)}>
    {/* The whole ref, folder and all: `task/x` and `fix/x` are different
        branches, and dropping the folder loses the half people sort by. */}
    <span className="min-w-0 flex-1 truncate">{candidate.label}</span>
    {candidate.aimed && (
      <span className="shrink-0 text-xs text-muted-foreground">lands here</span>
    )}
    <CheckMark on={isComparing(comparison, candidate.ref)} />
  </DropdownMenuItem>
);

/**
 * The menu's body, kept apart from the button so it can be read — and tested —
 * without a pointer.
 */
export function CompareMenuItems({
  comparison,
  branch,
  aim,
  branches,
  remoteBranches,
  onSelect,
}: ComparePickerProps) {
  const [query, setQuery] = useState("");
  const candidates = comparisonCandidates({
    branches,
    remoteBranches,
    current: branch,
    aim,
    query,
  });
  const searching = query.trim().length > 0;
  const here = branch ?? "this checkout";
  return (
    <>
      <MenuSearch label="Search branches" value={query} onChange={setQuery} />
      {/* The answer that needs no branch, and the one the view opens on. Out of
          the way while searching: a filter is a search for a branch. */}
      {!searching && (
        <DropdownMenuItem onClick={() => onSelect(null)}>
          <IconPencil className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">Uncommitted changes</span>
            <span className="truncate text-xs text-muted-foreground">
              What ‘{here}’ has not committed yet
            </span>
          </span>
          <CheckMark on={isComparing(comparison, null)} />
        </DropdownMenuItem>
      )}
      {candidates.local.length > 0 && (
        <DropdownMenuGroup>
          {!searching && <DropdownMenuSeparator />}
          <DropdownMenuLabel>Compare against a branch</DropdownMenuLabel>
          {candidates.local.map((candidate) => (
            <CandidateRow
              key={candidate.ref}
              candidate={candidate}
              comparison={comparison}
              onSelect={onSelect}
            />
          ))}
        </DropdownMenuGroup>
      )}
      {candidates.remote.length > 0 && (
        <DropdownMenuGroup>
          {/* Only where there is something above to be parted from: a search
              that matches no local branch leaves the rule under the filter
              box, which already has one. */}
          {(!searching || candidates.local.length > 0) && (
            <DropdownMenuSeparator />
          )}
          {/* Kept as its own group: `origin/feature` against `feature` is the
              question "what have I not pushed yet", which is a different one
              from anything the local list answers. */}
          <DropdownMenuLabel>Compare against a remote</DropdownMenuLabel>
          {candidates.remote.map((candidate) => (
            <CandidateRow
              key={candidate.ref}
              candidate={candidate}
              comparison={comparison}
              onSelect={onSelect}
            />
          ))}
        </DropdownMenuGroup>
      )}
      {noCandidates(candidates) && (
        <p className="px-2 py-4 text-center text-sm text-muted-foreground">
          No branch matches.
        </p>
      )}
    </>
  );
}

/** The menu keeps to a few rows and scrolls the rest, like the branch picker. */
const MENU_HEIGHT = "max-h-[min(20rem,70vh)]";

export function ComparePicker(props: ComparePickerProps) {
  const labels = comparisonLabels(props.comparison, props.branch);
  const remote =
    props.comparison.kind === "branch" &&
    props.comparison.against.includes("/");
  const BaseIcon =
    props.comparison.kind === "uncommitted"
      ? IconGitCompare
      : remote
        ? IconWorld
        : IconGitBranch;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="chip"
            // Shrinkable, unlike the buttons it sits among: it is the widest
            // thing on the row and the row is shared, so it gives way rather
            // than pushing what flanks it off the edge.
            // A share of the row rather than a fixed width: it sits between
            // two things that will not shrink for it — a branch picker and the
            // layout toggle — so on a narrow window it has to be the one that
            // gives way, or it grows out over them.
            className="max-w-[min(24rem,38%)] min-w-0 shrink gap-1.5 px-2 font-normal"
            aria-label={labels.summary}
            title={labels.summary}
          >
            <BaseIcon className="size-3.5 shrink-0 text-muted-foreground" />
            {/* The left-hand side is the half that changes, so it keeps its
                room and the right gives way first — and only once the right
                has nothing left to give does this start to go. */}
            <span className="max-w-48 shrink-[0.15] truncate">
              {labels.base}
            </span>
            {/* The relation, between the two things it relates — the same
                glyph the trail puts between a diff and what it is read
                against. */}
            <IconGitCompare className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-muted-foreground">
              {labels.headShort}
            </span>
            <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className={cn(MENU_HEIGHT, "w-80 overflow-x-hidden overflow-y-auto")}
      >
        <CompareMenuItems {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
