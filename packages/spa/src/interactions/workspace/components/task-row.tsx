/**
 * One line of the task list.
 *
 * The row is a grid rather than a flex chain so the key, the title and the
 * trailing metadata line up down the whole list even as titles and label sets
 * vary — the thing that makes a long list scannable. Sub-tasks indent through a
 * spacer column, and the disclosure sits in the indent so it never shifts the
 * columns to its right.
 */
import { IconChevronRight } from "@tabler/icons-react"
import { memo } from "react"
import type { Label } from "@byconvo/core/labels"
import type { Task } from "@byconvo/core/tasks"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/relative-time"
import { LabelChip, PriorityIcon, StatusIcon } from "./task-glyphs"

export interface TaskRowProps {
  task: Task
  depth: number
  hasChildren: boolean
  expanded: boolean
  labels: ReadonlyArray<Label>
  selected: boolean
  onSelect: (task: Task) => void
  onToggleExpanded: (id: string) => void
}

const INDENT_PER_LEVEL = 20

/** Past three, the chips stop naming the task and start crowding the title. */
const MAX_VISIBLE_LABELS = 3

function TaskRowImpl({
  task,
  depth,
  hasChildren,
  expanded,
  labels,
  selected,
  onSelect,
  onToggleExpanded,
}: TaskRowProps) {
  const overflow = labels.length - MAX_VISIBLE_LABELS

  return (
    <div
      role="row"
      aria-selected={selected}
      tabIndex={0}
      onClick={() => onSelect(task)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect(task)
        }
      }}
      className={cn(
        "group relative grid h-11 cursor-default grid-cols-[--spacing(4)_--spacing(4)_--spacing(4)_auto_1fr_auto] items-center gap-2.5 pr-3 text-base outline-none sm:h-10 sm:text-sm",
        "border-b border-foreground/5 last:border-b-0",
        selected ? "bg-elevate-strong" : "hover:bg-elevate",
        // The accent marks what is selected — the one job it has in this app.
        "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-brand-500",
        !selected && "before:hidden",
        "focus-visible:inset-ring-2 focus-visible:inset-ring-ring/60"
      )}
      style={{ paddingLeft: `${12 + depth * INDENT_PER_LEVEL}px` }}
    >
      {/* Disclosure, or a spacer that keeps every row's columns aligned. */}
      {hasChildren ? (
        <button
          type="button"
          aria-label={expanded ? "Hide sub-tasks" : "Show sub-tasks"}
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation()
            onToggleExpanded(task.id)
          }}
          className="-ml-1 flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-elevate-strong hover:text-foreground"
        >
          <IconChevronRight
            className={cn(
              "size-4 shrink-0 transition-transform duration-100",
              expanded && "rotate-90"
            )}
          />
        </button>
      ) : (
        <span className="-ml-1 size-4" aria-hidden />
      )}

      <PriorityIcon priority={task.priority} />
      <StatusIcon status={task.status} />

      <span className="w-16 shrink-0 font-mono text-sm text-muted-foreground tabular-nums sm:text-xs">
        {task.key}
      </span>

      <p
        className={cn(
          "min-w-0 truncate",
          task.status === "canceled" && "text-muted-foreground line-through"
        )}
      >
        {task.title}
      </p>

      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden items-center gap-1.5 md:flex">
          {labels.slice(0, MAX_VISIBLE_LABELS).map((label) => (
            <LabelChip key={label.id} name={label.name} color={label.color} />
          ))}
          {overflow > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums sm:text-xs">
              +{overflow}
            </span>
          )}
        </div>
        <span className="w-12 text-right text-sm text-muted-foreground tabular-nums sm:text-xs">
          {timeAgo(task.updatedAt)}
        </span>
      </div>
    </div>
  )
}

/**
 * A workspace can run to hundreds of tasks and the list re-renders on every
 * keystroke in the search box; memoising on the row's own inputs keeps that to
 * the rows that actually changed.
 */
export const TaskRow = memo(TaskRowImpl)
