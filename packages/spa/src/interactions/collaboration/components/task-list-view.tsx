/**
 * A project's tasks as Linear lists them: collapsible status groups with a
 * count and an add button, one dense row per task, and sub-issues nested under
 * their parent behind a guide line.
 */
import {
  IconChevronRight,
  IconLayoutSidebarRightExpand,
  IconAdjustmentsHorizontal,
  IconFilter,
  IconPlus,
} from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { useState, type CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AssigneeAvatar } from "@/interactions/collaboration/components/assignee-avatar"
import { PaneHeader } from "@/interactions/collaboration/components/pane-header"
import { TaskPriorityIcon } from "@/interactions/collaboration/components/task-priority-icon"
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon"
import {
  projectTasks,
  STATUS_LABEL,
  STATUS_ORDER,
  taskChildren,
  type MockProject,
  type MockTask,
  type TaskStatus,
} from "@/interactions/collaboration/data/collaboration.mock"
import { cn } from "@/lib/utils"

/** The tint each group header wears, matching its status icon. */
const GROUP_TINT: Record<TaskStatus, string> = {
  doing: "bg-amber-500/5",
  review: "bg-brand-500/5",
  todo: "bg-muted/40",
  done: "bg-emerald-500/5",
}

function TaskRow({ task, nested }: { task: MockTask; nested?: boolean }) {
  return (
    <Link
      to="/modes/collaboration"
      search={{ view: "task", id: task.id }}
      className={cn(
        "group/row flex h-9 items-center gap-2.5 px-3 text-[13px] outline-none hover:bg-elevate focus-visible:bg-elevate",
        nested === true && "pl-9"
      )}
    >
      <TaskPriorityIcon priority={task.priority} />
      <span className="w-16 shrink-0 truncate font-mono text-xs text-muted-foreground">
        {task.key}
      </span>
      <TaskStatusIcon status={task.status} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          task.status === "done" && "text-muted-foreground"
        )}
      >
        {task.title}
      </span>
      <AssigneeAvatar name={task.assignee} />
      <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {task.updated}
      </span>
    </Link>
  )
}

function Group({
  status,
  tasks,
}: {
  status: TaskStatus
  tasks: ReadonlyArray<MockTask>
}) {
  const [open, setOpen] = useState(true)
  const parents = tasks.filter((t) => t.parentId === undefined)

  return (
    <section>
      <div
        className={cn(
          "sticky top-0 z-10 flex h-9 items-center gap-2 px-3",
          GROUP_TINT[status]
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${STATUS_LABEL[status]}`}
          className="grid size-4 shrink-0 place-items-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <IconChevronRight
            className={cn(
              "size-3 transition-transform duration-100",
              open && "rotate-90"
            )}
          />
        </button>
        <TaskStatusIcon status={status} />
        <h2 className="text-[13px] font-medium">{STATUS_LABEL[status]}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto text-muted-foreground"
          aria-label={`Add a task to ${STATUS_LABEL[status]}`}
        >
          <IconPlus className="size-4" />
        </Button>
      </div>

      {open &&
        parents.map((task) => {
          const children = taskChildren(task.id).filter(
            (child) => child.status === status
          )
          return (
            <div key={task.id}>
              <TaskRow task={task} />
              {children.length > 0 && (
                <div className="relative before:absolute before:top-0 before:bottom-0 before:left-[1.4375rem] before:w-px before:bg-border">
                  {children.map((child) => (
                    <TaskRow key={child.id} task={child} nested />
                  ))}
                </div>
              )}
            </div>
          )
        })}
    </section>
  )
}

export function TaskListView({ project }: { project: MockProject }) {
  const tasks = projectTasks(project.id)
  const groups = STATUS_ORDER.map((status) => ({
    status,
    tasks: tasks.filter((t) => t.status === status),
  })).filter((group) => group.tasks.length > 0)

  return (
    <>
      <PaneHeader
        crumbs={[
          <Link
            key="project"
            to="/modes/collaboration"
            search={{ view: "project", id: project.id }}
            className="flex min-w-0 items-center gap-1.5 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            <span
              className="size-3.5 shrink-0 rounded-[0.3rem] bg-(--mark)"
              style={{ "--mark": project.color } as CSSProperties}
            />
            <span className="truncate">{project.name}</span>
          </Link>,
          <span key="tasks" className="font-medium">
            Tasks
          </span>,
        ]}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Filter"
            >
              <IconFilter className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Display options"
            >
              <IconAdjustmentsHorizontal className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Toggle the side panel"
            >
              <IconLayoutSidebarRightExpand className="size-4" />
            </Button>
          </>
        }
      />

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        {groups.map((group) => (
          <Group key={group.status} status={group.status} tasks={group.tasks} />
        ))}
        {groups.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No tasks in this project yet.
          </p>
        )}
      </ScrollArea>
    </>
  )
}
