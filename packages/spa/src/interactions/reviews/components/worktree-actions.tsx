/**
 * Landing a worktree's work, from the trail that names it.
 *
 * A selector rather than a button with a menu bolted on: where the work goes is
 * the question, and pressing "merge" without answering it is only ever right by
 * luck. The branch you last landed on is checked, so the answer is one click
 * when it has not changed.
 *
 * It appears only once there are commits. A worktree with nothing committed has
 * nothing to land, and offering the choice anyway makes the trail carry a
 * control that cannot work for most of a task's life.
 */
import { IconCheck, IconGitMerge } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LocalTask } from "@byconvo/core/repo";
import { MenuSearch } from "./diff-source-menu";

export function MergeSelector({
  worktree,
  branches,
  target,
  busy,
  onMerge,
}: {
  worktree: LocalTask;
  /** Everywhere it could land — the branches the main worktree holds. */
  branches: ReadonlyArray<string>;
  /** Where it lands unless another is picked. */
  target: string;
  busy: boolean;
  onMerge: (base: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      branches
        .filter((branch) => branch !== worktree.branch)
        .filter((branch) => q === "" || branch.toLowerCase().includes(q)),
    [branches, worktree.branch, q]
  );
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              aria-label={`Merge ‘${worktree.branch}’`}
              render={<Button variant="ghost" size="xs" disabled={busy} />}
            />
          }
        >
          <IconGitMerge />
          Merge
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {`Land the ${worktree.ahead} commit${worktree.ahead === 1 ? "" : "s"} on ‘${worktree.branch}’ and retire its worktree.`}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="max-h-[min(60vh,24rem)] min-w-56 overflow-y-auto"
      >
        <MenuSearch label="Search branches" value={query} onChange={setQuery} />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Merge into</DropdownMenuLabel>
          {shown.map((branch) => (
            <DropdownMenuItem key={branch} onClick={() => onMerge(branch)}>
              <span className="min-w-0 flex-1 truncate">{branch}</span>
              <IconCheck
                className={cn(
                  "size-4 shrink-0",
                  branch === target ? "opacity-100" : "opacity-0"
                )}
              />
            </DropdownMenuItem>
          ))}
          {shown.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              No branch matches.
            </p>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Said before the merge rather than after: uncommitted work in the worktree is
 * about to stop existing, and a warning that arrives once the directory is gone
 * is not a warning.
 */
export const mergeWarning = (worktree: LocalTask): string | null =>
  worktree.dirty
    ? `‘${worktree.branch}’ has uncommitted changes. Merging takes its commits and retires the worktree — anything not committed goes with it.`
    : null;
