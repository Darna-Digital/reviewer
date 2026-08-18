/**
 * What a worktree can be done to, sitting in the trail beside the crumb that
 * names it.
 *
 * Not a bar of its own: a bar would repeat the branch and its base, which the
 * trail has already said, and it would make reading a worktree look different
 * from reading the changes in front of you. The point of the one diff view is
 * that reading is the same everywhere and only what you can *do* changes, so
 * only that is here.
 *
 * Merging is the end it was for, and says so — the worktree goes with it, which
 * is the thing worth knowing before pressing it. Updating is the way out of the
 * one state that blocks a merge, and happens in the worktree itself, where
 * whoever is working there can settle any conflicts. Discarding is the other
 * ending, and the only one a worktree with nothing committed can have.
 */
import { IconGitMerge, IconRefresh, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LocalTask } from "@byconvo/core/repo";
import {
  isMergeable,
  worktreeState,
  WORKTREE_STATE_LABEL,
} from "../functions/reviews.functions";

const STATE_TONE: Record<string, string> = {
  working: "text-muted-foreground",
  behind: "text-amber-600 dark:text-amber-400",
  uncommitted: "text-amber-600 dark:text-amber-400",
  ready: "text-emerald-600 dark:text-emerald-400",
};

/** Why the merge button is off, in the words that say what to do about it. */
const blockedBecause = (worktree: LocalTask): string | null =>
  worktree.upToDate
    ? null
    : `‘${worktree.branch}’ is behind ‘${worktree.base}’. Update it first.`;

export function WorktreeActions({
  worktree,
  busy,
  onMerge,
  onUpdate,
  onDiscard,
}: {
  worktree: LocalTask;
  busy: boolean;
  onMerge: () => void;
  onUpdate: () => void;
  onDiscard: () => void;
}) {
  const state = worktreeState(worktree);
  const blocked = blockedBecause(worktree);
  // A worktree that has committed nothing cannot be merged and never will be by
  // waiting. Offering only a dead Merge button makes it a dead end, so getting
  // rid of it becomes the thing on offer instead.
  const nothingToMerge = worktree.ahead === 0;

  return (
    <>
      <span className={cn("truncate text-xs", STATE_TONE[state])}>
        {WORKTREE_STATE_LABEL[state]}
      </span>
      {!worktree.upToDate && (
        <Tooltip>
          <TooltipTrigger
            render={
              // The base is already the crumb to the left, so the button need
              // not say it twice — but it is what pressing this pulls from.
              <Button
                variant="ghost"
                size="xs"
                disabled={busy}
                onClick={onUpdate}
              >
                <IconRefresh /> Update
              </Button>
            }
          />
          <TooltipContent side="bottom">
            Update from ‘{worktree.base}’
          </TooltipContent>
        </Tooltip>
      )}
      {!nothingToMerge && (
        <Tooltip disabled={blocked === null}>
          <TooltipTrigger
            render={
              // A disabled button answers nothing, so the reason is wrapped
              // around it rather than hidden inside it.
              <span>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={busy || !isMergeable(worktree)}
                  onClick={onMerge}
                >
                  <IconGitMerge /> Merge
                </Button>
              </span>
            }
          />
          <TooltipContent side="bottom">{blocked}</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              disabled={busy}
              onClick={onDiscard}
              aria-label="Discard worktree"
            >
              <IconTrash />
            </Button>
          }
        />
        <TooltipContent side="bottom">Discard worktree</TooltipContent>
      </Tooltip>
    </>
  );
}

/**
 * What discarding will actually do, in the words that matter: whether the
 * commits survive. Asked every time — removing a directory somebody's agent has
 * been working in is not something to do on one click.
 */
export const discardWarning = (worktree: LocalTask): string =>
  worktree.ahead > 0
    ? `Discard the worktree for ‘${worktree.branch}’? Its ${worktree.ahead} commit${worktree.ahead === 1 ? "" : "s"} stay on the branch — only the directory and its services go.${worktree.dirty ? " Uncommitted changes there will be lost." : ""}`
    : `Discard ‘${worktree.branch}’? It has no commits, so the worktree and the branch both go.${worktree.dirty ? " Uncommitted changes there will be lost." : ""}`;

/**
 * Said before the merge rather than after: uncommitted work in the worktree is
 * about to stop existing, and a warning that arrives once the directory is gone
 * is not a warning.
 */
export const mergeWarning = (worktree: LocalTask): string | null =>
  worktree.dirty
    ? `‘${worktree.branch}’ has uncommitted changes. Merging takes its commits and retires the worktree — anything not committed goes with it.`
    : null;
