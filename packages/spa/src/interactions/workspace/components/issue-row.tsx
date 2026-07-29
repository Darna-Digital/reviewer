/**
 * One line of the issue list.
 *
 * The row is a grid rather than a flex chain so the key, the title and the
 * trailing metadata line up down the whole list even as titles and label sets
 * vary — the thing that makes a long list scannable. Sub-issues indent through
 * a spacer column, and the disclosure sits in the indent so it never shifts the
 * columns to its right.
 */
import { IconChevronRight } from "@tabler/icons-react"
import { memo } from "react"
import type { Label } from "@byconvo/core/labels"
import type { Task } from "@byconvo/core/tasks"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/relative-time"
import { LabelChip, PriorityIcon, StatusIcon } from "./issue-glyphs"

export interface IssueRowProps {
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

function IssueRowImpl({
  task,
  depth,
  hasChildren,
  expanded,
  labels,
  selected,
  onSelect,
  onToggleExpanded,
}: IssueRowProps) {
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
        "group grid h-9 cursor-default grid-cols-[auto_auto_auto_1fr_auto] items-center gap-2 px-3 text-sm outline-none",
        "border-b border-border/40 last:border-b-0",
        "hover:bg-elevate focus-visible:bg-elevate",
        selected && "bg-elevate-strong"
      )}
      style={{ paddingLeft: 12 + depth * INDENT_PER_LEVEL }}
    >
      {/* Disclosure, or a spacer that keeps every row's columns aligned. */}
      {hasChildren ? (
        <button
          type="button"
          aria-label={expanded ? "Hide sub-issues" : "Show sub-issues"}
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation()
            onToggleExpanded(task.id)
          }}
          className="-ml-1 flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-elevate-strong hover:text-foreground"
        >
          <IconChevronRight
            className={cn(
              "size-3 transition-transform duration-100",
              expanded && "rotate-90"
            )}
          />
        </button>
      ) : (
        <span className="-ml-1 size-4" aria-hidden />
      )}

      <PriorityIcon priority={task.priority} />

      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
        {task.key}
      </span>

      <span className="flex min-w-0 items-center gap-2">
        <StatusIcon status={task.status} />
        <span
          className={cn(
            "truncate",
            task.status === "canceled" && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        {labels.map((label) => (
          <LabelChip key={label.id} name={label.name} color={label.color} />
        ))}
        <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
          {timeAgo(task.updatedAt)}
        </span>
      </span>
    </div>
  )
}

/**
 * A workspace can run to hundreds of issues and the list re-renders on every
 * keystroke in the search box; memoising on the row's own inputs keeps that to
 * the rows that actually changed.
 */
export const IssueRow = memo(IssueRowImpl)
