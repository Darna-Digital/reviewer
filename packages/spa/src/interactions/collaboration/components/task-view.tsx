/**
 * A single task, laid out the way Linear lays out an issue: the description and
 * its activity in the main column, properties down the right, and the position
 * in the list plus its arrows in the header.
 */
import {
  IconSend,
  IconChevronDown,
  IconChevronUp,
  IconDots,
  IconGitBranch,
  IconLink,
  IconMessage2,
  IconMoodPlus,
  IconPaperclip,
  IconPlus,
  IconStar,
  IconTag,
} from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import type { CSSProperties, ReactNode } from "react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AssigneeAvatar } from "@/interactions/collaboration/components/assignee-avatar"
import { TaskPriorityIcon } from "@/interactions/collaboration/components/task-priority-icon"
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon"
import {
  findProject,
  PRIORITY_LABEL,
  projectChannels,
  projectTasks,
  STATUS_LABEL,
  taskChildren,
  type MockActivity,
  type MockTask,
} from "@/interactions/collaboration/data/collaboration.mock"
import { cn } from "@/lib/utils"

const PROPERTY_ROW =
  "flex h-7 items-center gap-2 rounded-md px-1.5 text-[13px] outline-none hover:bg-elevate focus-visible:ring-3 focus-visible:ring-ring/30"

function ActivityEntry({ entry }: { entry: MockActivity }) {
  if (entry.kind === "comment") {
    return (
      <li className="rounded-xl border bg-elevate">
        <div className="flex items-center gap-2 px-3 pt-2.5">
          <Avatar name={entry.author} className="size-5" />
          <span className="text-[13px] font-medium">{entry.author}</span>
          <span className="text-xs text-muted-foreground">{entry.time}</span>
        </div>
        <p className="px-3 pt-1 pb-3 text-sm text-pretty">{entry.body}</p>
      </li>
    )
  }
  return (
    <li className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
      <Avatar name={entry.author} className="size-4" />
      <span className="min-w-0 truncate">
        <span className="text-foreground">{entry.author}</span> {entry.detail}
      </span>
      <span className="shrink-0">· {entry.time}</span>
    </li>
  )
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

export function TaskView({ task }: { task: MockTask }) {
  const project = findProject(task.projectId)
  const channel = projectChannels(task.projectId)[0]
  const children = taskChildren(task.id)
  const siblings = projectTasks(task.projectId).filter(
    (t) => t.parentId === task.parentId
  )
  const index = siblings.findIndex((t) => t.id === task.id)
  const previous = siblings[index - 1]
  const next = siblings[index + 1]

  return (
    <>
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-1.5 text-[13px]"
        >
          <Link
            to="/modes/collaboration"
            search={{ view: "tasks", id: task.projectId }}
            className="flex min-w-0 items-center gap-1.5 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            <span
              className="size-3.5 shrink-0 rounded-[0.3rem] bg-(--mark)"
              style={{ "--mark": project?.color } as CSSProperties}
            />
            <span className="truncate">{project?.name}</span>
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {task.key}
          </span>
          <span className="truncate font-medium">{task.title}</span>
        </nav>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground"
          aria-label="Favorite this task"
        >
          <IconStar className="size-4" />
        </Button>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <span className="pr-1 text-xs text-muted-foreground tabular-nums">
            {index + 1} / {siblings.length}
          </span>
          {previous !== undefined && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Previous task"
              render={
                <Link
                  to="/modes/collaboration"
                  search={{ view: "task", id: previous.id }}
                />
              }
            >
              <IconChevronUp className="size-4" />
            </Button>
          )}
          {next !== undefined && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Next task"
              render={
                <Link
                  to="/modes/collaboration"
                  search={{ view: "task", id: next.id }}
                />
              }
            >
              <IconChevronDown className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground max-sm:hidden"
            aria-label="Copy link"
          >
            <IconLink className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground max-sm:hidden"
            aria-label="Copy branch name"
          >
            <IconGitBranch className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Task options">
            <IconDots className="size-4" />
          </Button>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <div className="mx-auto flex w-full max-w-5xl gap-10 px-6 py-8 max-lg:flex-col max-lg:gap-8">
          <div className="min-w-0 flex-1">
            <h1 className="max-w-[50ch] text-xl font-semibold tracking-tight text-balance">
              {task.title}
            </h1>

            <div className="mt-4 flex flex-col gap-3">
              {task.description.map((paragraph) => (
                <p
                  key={paragraph}
                  className="max-w-[70ch] text-sm text-pretty text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="Add a reaction"
              >
                <IconMoodPlus className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="Attach a file"
              >
                <IconPaperclip className="size-4" />
              </Button>
            </div>

            <div className="mt-6">
              {children.length > 0 && (
                <ul role="list" className="mb-1 flex flex-col">
                  {children.map((child) => (
                    <li key={child.id}>
                      <Link
                        to="/modes/collaboration"
                        search={{ view: "task", id: child.id }}
                        className="flex h-8 items-center gap-2.5 rounded-md px-1.5 text-[13px] outline-none hover:bg-elevate focus-visible:bg-elevate"
                      >
                        <TaskStatusIcon status={child.status} />
                        <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                          {child.key}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {child.title}
                        </span>
                        <AssigneeAvatar name={child.assignee} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-md px-1.5 text-[13px] text-muted-foreground outline-none hover:bg-elevate hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <IconPlus className="size-4" />
                Add sub-issues
              </button>
            </div>

            <div className="mt-8 border-t pt-6">
              <h2 className="text-sm font-medium">Activity</h2>
              <ul role="list" className="mt-3 flex flex-col gap-3">
                {task.activity.map((entry) => (
                  <ActivityEntry key={entry.id} entry={entry} />
                ))}
                {task.activity.length === 0 && (
                  <li className="px-1 text-[13px] text-muted-foreground">
                    Nothing has happened here yet.
                  </li>
                )}
              </ul>

              <div className="mt-3 flex items-center gap-2 rounded-xl border px-3 py-2">
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Leave a reply…"
                />
                <Button
                  size="icon-sm"
                  className="shrink-0 rounded-full"
                  aria-label="Send reply"
                >
                  <IconSend className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          <aside className="flex w-56 shrink-0 flex-col gap-6 max-lg:w-full">
            <Property label="Properties">
              <div className="flex flex-col">
                <button type="button" className={PROPERTY_ROW}>
                  <TaskStatusIcon status={task.status} />
                  {STATUS_LABEL[task.status]}
                </button>
                <button type="button" className={PROPERTY_ROW}>
                  <TaskPriorityIcon priority={task.priority} />
                  {PRIORITY_LABEL[task.priority]}
                </button>
                <button type="button" className={PROPERTY_ROW}>
                  <AssigneeAvatar name={task.assignee} className="size-4" />
                  <span className="min-w-0 truncate">{task.assignee}</span>
                </button>
              </div>
            </Property>

            <Property label="Labels">
              <div className="flex flex-wrap items-center gap-1">
                {task.labels.map((label) => (
                  <span
                    key={label}
                    className="flex h-6 items-center rounded-full border px-2 text-xs text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
                <button
                  type="button"
                  className={cn(PROPERTY_ROW, "h-6 text-muted-foreground")}
                >
                  <IconTag className="size-4" />
                  Add label
                </button>
              </div>
            </Property>

            <Property label="Project">
              <Link
                to="/modes/collaboration"
                search={{ view: "project", id: task.projectId }}
                className={PROPERTY_ROW}
              >
                <span
                  className="size-3.5 shrink-0 rounded-[0.3rem] bg-(--mark)"
                  style={{ "--mark": project?.color } as CSSProperties}
                />
                <span className="min-w-0 truncate">{project?.name}</span>
              </Link>
            </Property>

            {channel !== undefined && (
              <Property label="Channel">
                <Link
                  to="/modes/collaboration"
                  search={{ view: "channel", id: channel.id }}
                  className={PROPERTY_ROW}
                >
                  <IconMessage2 className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">#{channel.name}</span>
                </Link>
              </Property>
            )}
          </aside>
        </div>
      </ScrollArea>
    </>
  )
}
