import type { TaskPriority } from "@/interactions/collaboration/data/collaboration.mock"
import { cn } from "@/lib/utils"

const FILLED: Record<TaskPriority, number> = {
  urgent: 3,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
}

const BAR_HEIGHTS = ["h-1.5", "h-2.5", "h-3.5"]

/** Linear's priority glyph: an urgent flag, or bars filled to the level. */
export function TaskPriorityIcon({ priority }: { priority: TaskPriority }) {
  if (priority === "urgent") {
    return (
      <span className="grid size-4 shrink-0 place-items-center rounded-[0.25rem] bg-orange-500 text-[0.625rem] font-bold text-white">
        !
      </span>
    )
  }
  const filled = FILLED[priority]
  return (
    <span className="flex size-4 shrink-0 items-end justify-center gap-px">
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={height}
          className={cn(
            "w-1 rounded-[1px]",
            height,
            index < filled ? "bg-muted-foreground" : "bg-muted-foreground/25"
          )}
        />
      ))}
    </span>
  )
}
