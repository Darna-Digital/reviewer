/**
 * The pane beside the list, showing one issue.
 *
 * Every field on it saves as it is changed rather than behind a Save button:
 * the collection applies the edit locally and reconciles in the background, so
 * there is nothing for a button to wait on. The title and description commit on
 * blur (and on ⌘↵) so a half-typed word is never written.
 */
import { IconPlus, IconTrash, IconX } from "@tabler/icons-react"
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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { timeAgo } from "@/lib/relative-time"
import { cn } from "@/lib/utils"
import { useCommentThread } from "../adapters/comments.hook.adapter"
import { CommentThread } from "./comment-thread"
import { LabelChip, PriorityIcon, StatusIcon } from "./issue-glyphs"

export interface IssueDetailProps {
  task: Task
  labels: ReadonlyArray<Label>
  projectLabels: ReadonlyArray<Label>
  subIssues: ReadonlyArray<Task>
  role: MemberRole | null
  onClose: () => void
  onStatus: (task: Task, status: TaskStatus) => void
  onPriority: (task: Task, priority: TaskPriority) => void
  onToggleLabel: (task: Task, labelId: string) => void
  onRename: (task: Task, title: string) => void
  onDescribe: (task: Task, description: string) => void
  onRemove: (id: string) => void
  onCreateSubIssue: (title: string) => Promise<boolean>
  onOpen: (task: Task) => void
}

/** A labelled row of the metadata column. */
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-start gap-2 py-1.5">
      <span className="pt-1 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function IssueDetail(props: IssueDetailProps) {
  const { task, labels, projectLabels, subIssues, role } = props
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [addingSub, setAddingSub] = useState(false)
  const [subTitle, setSubTitle] = useState("")

  // Reset the local drafts when a different issue is opened, and pick up an
  // edit that arrived from elsewhere (another tab, or the list's own rename).
  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description)
  }, [task.id, task.title, task.description])

  const comments = useCommentThread("task", task.id, role)

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col overflow-hidden border-l">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <span className="font-mono text-xs text-muted-foreground">
          {task.key}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Issue actions"
              className="rounded p-1 text-muted-foreground hover:bg-elevate hover:text-foreground"
            >
              <IconTrash className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => props.onRemove(task.id)}
              >
                Delete issue{subIssues.length > 0 && " and sub-issues"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Close"
            onClick={props.onClose}
          >
            <IconX />
          </Button>
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <textarea
          value={title}
          rows={1}
          aria-label="Issue title"
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => props.onRename(task, title)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              event.currentTarget.blur()
            }
            if (event.key === "Escape") setTitle(task.title)
          }}
          className="field-sizing-content w-full resize-none bg-transparent text-base leading-snug font-medium outline-none"
        />

        <div className="mt-2 border-y py-1">
          <Field label="Status">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[13px] hover:bg-elevate">
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
              <DropdownMenuTrigger className="flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[13px] hover:bg-elevate">
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
            <div className="flex flex-wrap items-center gap-1.5 py-0.5">
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
                  className="flex size-5 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:bg-elevate hover:text-foreground"
                >
                  <IconPlus className="size-3" />
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
            <span className="inline-block pt-1 text-[13px] text-muted-foreground">
              {timeAgo(task.updatedAt)}
              {task.completedAt !== null &&
                ` · completed ${timeAgo(task.completedAt)}`}
            </span>
          </Field>
        </div>

        <Textarea
          value={description}
          placeholder="Add a description…"
          aria-label="Issue description"
          rows={4}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => {
            if (description !== task.description) {
              props.onDescribe(task, description)
            }
          }}
          className="mt-3 min-h-[88px] resize-y border-none bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
        />

        <section className="mt-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">
              Sub-issues
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {subIssues.length}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="New sub-issue"
              className="ml-auto text-muted-foreground"
              onClick={() => setAddingSub(true)}
            >
              <IconPlus />
            </Button>
          </div>
          <div className="mt-1 flex flex-col">
            {subIssues.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => props.onOpen(child)}
                className="flex h-7 items-center gap-2 rounded-md px-1 text-left text-[13px] hover:bg-elevate"
              >
                <StatusIcon status={child.status} />
                <span className="font-mono text-xs text-muted-foreground">
                  {child.key}
                </span>
                <span className="truncate">{child.title}</span>
              </button>
            ))}
            {addingSub && (
              <input
                autoFocus
                value={subTitle}
                placeholder="Sub-issue title…"
                onChange={(event) => setSubTitle(event.target.value)}
                onBlur={() => {
                  if (subTitle.trim().length === 0) setAddingSub(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void props.onCreateSubIssue(subTitle).then((created) => {
                      if (created) setSubTitle("")
                    })
                  }
                  if (event.key === "Escape") setAddingSub(false)
                }}
                className="h-7 rounded-md bg-transparent px-1 text-[13px] outline-none placeholder:text-muted-foreground"
              />
            )}
          </div>
        </section>

        <section className={cn("mt-4 border-t pt-3")}>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">
            Comments{comments.count > 0 && ` · ${comments.count}`}
          </h3>
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
    </aside>
  )
}
