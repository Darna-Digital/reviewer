/**
 * Unclaimed work, and the one gesture that claims it.
 *
 * "Up for grabs" is derived, never set: nobody holds the task, nothing it waits
 * on is outstanding, and it sits in a horizon. That makes it a fact about
 * availability rather than a guess at how small the job is — how soon it
 * matters is already answered by which horizon it is in.
 */
import { IconHandGrab } from "@tabler/icons-react";
import { claimTask } from "@/interactions/collaboration/data/collaboration.mock";
import type { MockTask } from "@/interactions/collaboration/data/collaboration.mock";
import { cn } from "@/lib/utils";

export function ClaimButton({
  task,
  className,
}: {
  task: MockTask;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => claimTask(task.id)}
      aria-label={`Claim ${task.key}`}
      className={cn(
        "flex h-5 shrink-0 items-center gap-1 rounded-full border border-dashed px-1.5 text-[0.625rem] font-medium text-muted-foreground outline-none hover:border-solid hover:bg-elevate hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30",
        className
      )}
    >
      <IconHandGrab className="size-3" />
      Claim
    </button>
  );
}
