/**
 * The page for one task: its own location in the workspace, reached from the
 * list and linkable on its own.
 *
 * It is a page rather than a pane because a task is a place — the breadcrumbs
 * name the trail down from the project through any parent task, so a sub-task
 * three levels in still says where it sits and every level above it is one
 * click away.
 *
 * Every field on it saves as it is changed rather than behind a Save button:
 * the collection applies the edit locally and reconciles in the background, so
 * there is nothing for a button to wait on. The title and description commit on
 * blur (and on ⌘↵) so a half-typed word is never written.
 */
import { IconDots, IconPlus, IconTrash, IconX } from "@tabler/icons-react"
import { useEffect, useState } from "react"
import type { MemberRole } from "@byconvo/core/identity"
import type { Label } from "@byconvo/core/labels"
import {
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUS_LABEL,
  STATUS_ORDER,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@byconvo/core/tasks"
import { Breadcrumbs, type Crumb } from "@/components/layout/breadcrumbs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { timeAgo } from "@/lib/relative-time"
import { useCommentThread } from "../adapters/comments.hook.adapter"
import { CommentThread } from "./comment-thread"
import { LabelChip, PriorityIcon, StatusIcon } from "./task-glyphs"

export interface TaskDetailProps {
  task: Task
  labels: ReadonlyArray<Label>
  projectLabels: ReadonlyArray<Label>
  subTasks: ReadonlyArray<Task>
  /** The parents above this task, outermost first. */
  ancestors: ReadonlyArray<Task>
  projectName: string
  /** The rail's mobile trigger, so the page keeps its way back to the nav. */
  nav: React.ReactNode
  role: MemberRole | null
  onClose: () => void
  onStatus: (task: Task, status: TaskStatus) => void
  onPriority: (task: Task, priority: TaskPriority) => void
  onToggleLabel: (task: Task, labelId: string) => void
  onRename: (task: Task, title: string) => void
  onDescribe: (task: Task, description: string) => void
  onRemove: (id: string) => void
  onCreateSubTask: (title: string) => Promise<boolean>
  onOpen: (task: Task) => void
}

/** A labelled row of the properties block. */
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-start gap-3 py-2">
      <dt className="pt-1 text-base text-muted-foreground sm:text-sm">
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

/** The heading above each block of the pane below the properties. */
function SectionHeading({
  children,
  count,
  action,
}: {
  children: React.ReactNode
  count?: number
  action?: React.ReactNode
}) {
  return (
    <div className="flex h-7 items-center gap-2">
      <h3 className="text-base font-medium sm:text-sm">{children}</h3>
      {count !== undefined && count > 0 && (
        <p className="text-base text-muted-foreground tabular-nums sm:text-sm">
          {count}
        </p>
      )}
      {action !== undefined && <div className="ml-auto">{action}</div>}
    </div>
  )
}

const propertyTrigger =
  "-ml-2 flex h-7 items-center gap-2 rounded-lg px-2 text-base hover:bg-elevate aria-expanded:bg-elevate sm:text-sm"

export function TaskDetail(props: TaskDetailProps) {
  const { task, labels, projectLabels, subTasks, ancestors, role } = props
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [addingSub, setAddingSub] = useState(false)
  const [subTitle, setSubTitle] = useState("")

  // Reset the local drafts when a different task is opened, and pick up an edit
  // that arrived from elsewhere (another tab, or the list's own rename).
  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description)
  }, [task.id, task.title, task.description])

  const comments = useCommentThread("task", task.id, role)

  const crumbs: ReadonlyArray<Crumb> = [
    { id: "project", label: props.projectName, onClick: props.onClose },
    { id: "tasks", label: "Tasks", onClick: props.onClose },
    ...ancestors.map((parent) => ({
      id: parent.id,
      label: parent.key,
      mono: true,
      onClick: () => props.onOpen(parent),
    })),
    { id: task.id, label: task.key, mono: true },
  ]

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-foreground/10 px-3">
        {props.nav}
        <StatusIcon status={task.status} />
        <Breadcrumbs crumbs={crumbs} className="text-sm sm:text-xs" />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Task actions"
                  className="text-muted-foreground"
                />
              }
            >
              <IconDots />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => props.onRemove(task.id)}
              >
                <IconTrash className="size-4 shrink-0" />
                Delete task{subTasks.length > 0 && " and sub-tasks"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to the task list"
            className="text-muted-foreground"
            onClick={props.onClose}
          >
            <IconX />
          </Button>
        </div>
      </header>

      {/* Capped and centred: a task's prose is reading matter, and a title set
          across the full width of a desktop pane is not readable. */}
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
        <textarea
          value={title}
          rows={1}
          aria-label="Task title"
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => props.onRename(task, title)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              event.currentTarget.blur()
            }
            if (event.key === "Escape") setTitle(task.title)
          }}
          className="field-sizing-content w-full resize-none rounded-lg bg-transparent text-lg font-medium tracking-tight text-pretty outline-none focus-visible:bg-elevate"
        />

        <dl className="divide-y divide-foreground/5 border-y border-foreground/10">
          <Field label="Status">
            <DropdownMenu>
              <DropdownMenuTrigger className={propertyTrigger}>
                <StatusIcon status={task.status} decorative />
                {STATUS_LABEL[task.status]}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {STATUS_ORDER.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => props.onStatus(task, status)}
                  >
                    <StatusIcon status={status} decorative />
                    {STATUS_LABEL[status]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </Field>

          <Field label="Priority">
            <DropdownMenu>
              <DropdownMenuTrigger className={propertyTrigger}>
                <PriorityIcon priority={task.priority} decorative />
                {PRIORITY_LABEL[task.priority]}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {PRIORITY_ORDER.map((priority) => (
                  <DropdownMenuItem
                    key={priority}
                    onClick={() => props.onPriority(task, priority)}
                  >
                    <PriorityIcon priority={priority} decorative />
                    {PRIORITY_LABEL[priority]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </Field>

          <Field label="Labels">
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {labels.map((label) => (
                <LabelChip
                  key={label.id}
                  name={label.name}
                  color={label.color}
                />
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Add a label"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-foreground/20 text-muted-foreground hover:bg-elevate hover:text-foreground sm:size-5"
                >
                  <IconPlus className="size-3 shrink-0" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {projectLabels.length === 0 ? (
                    <DropdownMenuItem disabled>
                      No labels in this project
                    </DropdownMenuItem>
                  ) : (
                    projectLabels.map((label) => (
                      <DropdownMenuCheckboxItem
                        key={label.id}
                        checked={task.labelIds.includes(label.id)}
                        onClick={() => props.onToggleLabel(task, label.id)}
                      >
                        {label.name}
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Field>

          <Field label="Updated">
            <p className="pt-1 text-base text-muted-foreground sm:text-sm">
              {timeAgo(task.updatedAt)}
              {task.completedAt !== null &&
                ` · completed ${timeAgo(task.completedAt)}`}
            </p>
          </Field>
        </dl>

        <section className="flex flex-col gap-1">
          <SectionHeading>Description</SectionHeading>
          <textarea
            value={description}
            placeholder="Add a description…"
            aria-label="Task description"
            rows={4}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => {
              if (description !== task.description) {
                props.onDescribe(task, description)
              }
            }}
            className="field-sizing-content min-h-24 w-full resize-none rounded-2xl bg-muted/50 p-3 text-base/6 outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/30 sm:text-sm/6"
          />
        </section>

        <section className="flex flex-col gap-1">
          <SectionHeading
            count={subTasks.length}
            action={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="New sub-task"
                className="text-muted-foreground"
                onClick={() => setAddingSub(true)}
              >
                <IconPlus />
              </Button>
            }
          >
            Sub-tasks
          </SectionHeading>

          {subTasks.length === 0 && !addingSub && (
            <p className="text-base/6 text-muted-foreground sm:text-sm/6">
              None yet — break this task down if it needs it.
            </p>
          )}

          <div className="flex flex-col">
            {subTasks.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => props.onOpen(child)}
                className="flex h-9 items-center gap-2.5 rounded-lg px-2 text-left text-base hover:bg-elevate sm:h-8 sm:text-sm"
              >
                <StatusIcon status={child.status} />
                <span className="shrink-0 font-mono text-sm text-muted-foreground tabular-nums sm:text-xs">
                  {child.key}
                </span>
                <span className="min-w-0 truncate">{child.title}</span>
              </button>
            ))}
            {addingSub && (
              <input
                autoFocus
                value={subTitle}
                placeholder="Sub-task title…"
                aria-label="Sub-task title"
                onChange={(event) => setSubTitle(event.target.value)}
                onBlur={() => {
                  if (subTitle.trim().length === 0) setAddingSub(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void props.onCreateSubTask(subTitle).then((created) => {
                      if (created) setSubTitle("")
                    })
                  }
                  if (event.key === "Escape") setAddingSub(false)
                }}
                className="h-9 rounded-lg bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground sm:h-8 sm:text-sm"
              />
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2 border-t border-foreground/10 pt-4">
          <SectionHeading count={comments.count}>Comments</SectionHeading>
          <CommentThread
            tree={comments.tree}
            isLoading={comments.isLoading}
            onPost={comments.post}
            onEdit={comments.edit}
            onRemove={comments.remove}
            canEdit={comments.canEdit}
            canDelete={comments.canDelete}
          />
        </section>
      </div>
    </main>
  )
}
