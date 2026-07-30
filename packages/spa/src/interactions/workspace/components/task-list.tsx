/**
 * The task list: status groups, each collapsible, each with an inline composer.
 * This is the screen the workspace is really about, so it is a plain scroll
 * container with sticky group headers rather than anything cleverer — the rows
 * are cheap and memoised, and a sticky header keeps the column you are reading
 * named while you scroll through it.
 */
import { IconChevronRight, IconPlus, IconStack2 } from "@tabler/icons-react"
import { useState } from "react"
import type { Label } from "@byconvo/core/labels"
import type { Task, TaskStatus } from "@byconvo/core/tasks"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TaskGroup } from "../interfaces/workspace.interfaces"
import { StatusIcon } from "./task-glyphs"
import { TaskRow } from "./task-row"

export interface TaskListProps {
  groups: ReadonlyArray<TaskGroup>
  labelsOf: (task: Task) => ReadonlyArray<Label>
  selectedId: string | null
  expandedTasks: ReadonlySet<string>
  onSelect: (task: Task) => void
  onToggleExpanded: (id: string) => void
  onCreate: (title: string, status: TaskStatus) => Promise<boolean>
  isLoading: boolean
  /** Set while a search or label filter is narrowing the list. */
  isFiltered: boolean
  onClearFilters: () => void
}

function GroupComposer({
  status,
  onCreate,
  onDone,
}: {
  status: TaskStatus
  onCreate: (title: string, status: TaskStatus) => Promise<boolean>
  onDone: () => void
}) {
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    setBusy(true)
    const created = await onCreate(title, status)
    setBusy(false)
    // A blank title is a no-op, so keep the field open and focused rather than
    // closing the composer on a keystroke the writer did not mean to send.
    if (created) setTitle("")
  }

  return (
    <div className="flex h-11 items-center gap-2.5 border-b border-foreground/5 pr-3 pl-11 sm:h-10">
      <StatusIcon status={status} decorative />
      <input
        autoFocus
        value={title}
        disabled={busy}
        placeholder="Task title…"
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => {
          if (title.trim().length === 0) onDone()
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            void submit()
          }
          if (event.key === "Escape") onDone()
        }}
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
      />
    </div>
  )
}

function EmptyState({
  isFiltered,
  onClearFilters,
  onCreate,
}: {
  isFiltered: boolean
  onClearFilters: () => void
  onCreate: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="flex flex-col items-center gap-1 rounded-3xl border border-dashed border-foreground/15 px-6 py-14 text-center">
        <IconStack2 className="size-4 shrink-0 text-muted-foreground" />
        <p className="mt-2 text-base font-medium sm:text-sm">
          {isFiltered ? "No tasks match these filters" : "No tasks yet"}
        </p>
        <p className="max-w-[48ch] text-base/6 text-pretty text-muted-foreground sm:text-sm/6">
          {isFiltered
            ? "Try a different search, or clear the label filters to see the whole project."
            : "Tasks are the unit of work in a project — file the first one and it shows up here, grouped by status."}
        </p>
        {isFiltered ? (
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={onClearFilters}
          >
            Clear filters
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            data-icon="inline-start"
            onClick={onCreate}
          >
            <IconPlus />
            New task
          </Button>
        )}
      </div>
    </div>
  )
}

export function TaskList({
  groups,
  labelsOf,
  selectedId,
  expandedTasks,
  onSelect,
  onToggleExpanded,
  onCreate,
  isLoading,
  isFiltered,
  onClearFilters,
}: TaskListProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<TaskStatus>>(
    () => new Set()
  )
  const [composing, setComposing] = useState<TaskStatus | null>(null)

  const toggleGroup = (status: TaskStatus) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })

  const openComposer = (status: TaskStatus) => {
    setComposing(status)
    setCollapsed((current) => {
      const next = new Set(current)
      next.delete(status)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-3">
        {/* Rows rather than a spinner: the list keeps its shape while it loads,
            so nothing jumps when the real tasks arrive. */}
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="h-10 shrink-0 animate-pulse rounded-lg bg-elevate"
            style={{ opacity: 1 - index * 0.11 }}
          />
        ))}
      </div>
    )
  }

  // With nothing filed yet there is no group header to hang a composer off, so
  // the empty state opens one against the status a new task lands in.
  if (groups.length === 0 && composing === null) {
    return (
      <EmptyState
        isFiltered={isFiltered}
        onClearFilters={onClearFilters}
        onCreate={() => openComposer("todo")}
      />
    )
  }

  return (
    <div
      role="table"
      className="group/list flex min-h-0 flex-1 flex-col overflow-y-auto"
    >
      {groups.length === 0 && composing !== null && (
        <GroupComposer
          status={composing}
          onCreate={onCreate}
          onDone={() => setComposing(null)}
        />
      )}

      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.status)
        return (
          <section key={group.status} aria-label={group.label}>
            <header className="sticky top-0 z-10 flex h-10 items-center gap-2.5 border-b border-foreground/10 bg-surface-2 px-3">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                aria-label={`${isCollapsed ? "Show" : "Hide"} ${group.label}`}
                onClick={() => toggleGroup(group.status)}
                className="-ml-1 flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-elevate hover:text-foreground"
              >
                <IconChevronRight
                  className={cn(
                    "size-4 shrink-0 transition-transform duration-100",
                    !isCollapsed && "rotate-90"
                  )}
                />
              </button>
              <StatusIcon status={group.status} decorative />
              <p className="text-base font-medium sm:text-sm">{group.label}</p>
              <p className="text-base text-muted-foreground tabular-nums sm:text-sm">
                {group.count}
              </p>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`New task in ${group.label}`}
                className="ml-auto text-muted-foreground"
                onClick={() => openComposer(group.status)}
              >
                <IconPlus />
              </Button>
            </header>

            {!isCollapsed && (
              <>
                {composing === group.status && (
                  <GroupComposer
                    status={group.status}
                    onCreate={onCreate}
                    onDone={() => setComposing(null)}
                  />
                )}
                {group.rows.map((row) => (
                  <TaskRow
                    key={row.task.id}
                    task={row.task}
                    depth={row.depth}
                    hasChildren={row.hasChildren}
                    expanded={expandedTasks.has(row.task.id)}
                    labels={labelsOf(row.task)}
                    selected={selectedId === row.task.id}
                    onSelect={onSelect}
                    onToggleExpanded={onToggleExpanded}
                  />
                ))}
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}
