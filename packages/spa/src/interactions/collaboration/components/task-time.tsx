/**
 * Time as this product treats it: only ever what was already spent.
 *
 * There is no estimate to compare against and no bar filling towards one — a
 * task shows the minutes somebody put into it, and the clock that adds to them
 * runs on one task at a time because a person does too.
 */
import {
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
} from "@tabler/icons-react";
import { toggleTracking } from "@/interactions/collaboration/data/collaboration.mock";
import type { MockTask } from "@/interactions/collaboration/data/collaboration.mock";
import { useLiveSpent } from "@/interactions/collaboration/data/use-tasks";
import { formatSpent } from "@/interactions/collaboration/functions/task-flow.functions";
import { cn } from "@/lib/utils";

export function SpentLabel({
  task,
  className,
}: {
  task: MockTask;
  className?: string;
}) {
  const { minutes, running, seconds } = useLiveSpent(task);
  if (minutes === 0 && !running) return null;
  return (
    <span
      className={cn(
        "shrink-0 text-xs tabular-nums",
        running
          ? "text-amber-600 dark:text-amber-400"
          : "text-muted-foreground",
        className
      )}
    >
      {formatSpent(minutes)}
      {running && (
        <span className="opacity-70">:{String(seconds).padStart(2, "0")}</span>
      )}
    </span>
  );
}

export function TrackButton({ task }: { task: MockTask }) {
  const { running } = useLiveSpent(task);
  const Icon = running ? IconPlayerStopFilled : IconPlayerPlayFilled;
  return (
    <button
      type="button"
      onClick={() => toggleTracking(task.id)}
      aria-label={running ? "Stop the clock" : "Start the clock"}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        running
          ? "text-amber-600 hover:bg-elevate dark:text-amber-400"
          : "text-muted-foreground hover:bg-elevate hover:text-foreground"
      )}
    >
      <Icon className="size-3" />
    </button>
  );
}
