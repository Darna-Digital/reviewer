/**
 * The issue list: status groups, each collapsible, each with an inline
 * composer. This is the screen the workspace is really about, so it is a plain
 * scroll container with sticky group headers rather than anything cleverer —
 * the rows are cheap and memoised, and a sticky header keeps the column you are
 * reading named while you scroll through it.
 */
import { IconChevronRight, IconPlus } from "@tabler/icons-react"
import { useState } from "react"
import type { Label } from "@byconvo/core/labels"
import type { Task, TaskStatus } from "@byconvo/core/tasks"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { IssueGroup } from "../interfaces/workspace.interfaces"
import { StatusIcon } from "./issue-glyphs"
import { IssueRow } from "./issue-row"

export interface IssueListProps {
  groups: ReadonlyArray<IssueGroup>
  labelsOf: (task: Task) => ReadonlyArray<Label>
  selectedId: string | null
  expandedIssues: ReadonlySet<string>
  onSelect: (task: Task) => void
  onToggleExpanded: (id: string) => void
  onCreate: (title: string, status: TaskStatus) => Promise<boolean>
  isLoading: boolean
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
    <div className="flex h-9 items-center gap-2 border-b border-border/40 pr-3 pl-11">
      <StatusIcon status={status} />
      <input
        autoFocus
        value={title}
        disabled={busy}
        placeholder="Issue title…"
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
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

export function IssueList({
  groups,
  labelsOf,
  selectedId,
  expandedIssues,
  onSelect,
  onToggleExpanded,
  onCreate,
  isLoading,
}: IssueListProps) {
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

  if (isLoading) {
    return (
      <div className="p-3">
        {/* Rows rather than a spinner: the list keeps its shape while it loads,
            so nothing jumps when the real issues arrive. */}
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="mb-1.5 h-9 animate-pulse rounded-md bg-elevate"
            style={{ opacity: 1 - index * 0.14 }}
          />
        ))}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-sm">
        <div className="font-medium">No issues yet</div>
        <div className="text-muted-foreground">
          Create one with the button above, or clear the filters.
        </div>
      </div>
    )
  }

  return (
    <div role="table" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.status)
        return (
          <section key={group.status} aria-label={group.label}>
            <header
              className={cn(
                "sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-border/60 px-3",
                // The header is opaque so rows scrolling under it stay hidden.
                "bg-surface-2/95 backdrop-blur-sm"
              )}
            >
              <button
                type="button"
                aria-expanded={!isCollapsed}
                aria-label={`${isCollapsed ? "Show" : "Hide"} ${group.label}`}
                onClick={() => toggleGroup(group.status)}
                className="flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-elevate hover:text-foreground"
              >
                <IconChevronRight
                  className={cn(
                    "size-3 transition-transform duration-100",
                    !isCollapsed && "rotate-90"
                  )}
                />
              </button>
              <StatusIcon status={group.status} decorative />
              <span className="text-[13px] font-medium">{group.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {group.count}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`New issue in ${group.label}`}
                className="ml-auto text-muted-foreground"
                onClick={() => {
                  setComposing(group.status)
                  setCollapsed((current) => {
                    const next = new Set(current)
                    next.delete(group.status)
                    return next
                  })
                }}
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
                  <IssueRow
                    key={row.task.id}
                    task={row.task}
                    depth={row.depth}
                    hasChildren={row.hasChildren}
                    expanded={expandedIssues.has(row.task.id)}
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
