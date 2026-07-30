import { IconDots, IconMessage2 } from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AssigneeAvatar } from "@/interactions/collaboration/components/assignee-avatar"
import {
  PaneBody,
  PaneHeader,
} from "@/interactions/collaboration/components/pane-header"
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon"
import {
  findProject,
  projectChannels,
  STATUS_LABEL,
  type MockTask,
} from "@/interactions/collaboration/data/collaboration.mock"
import { cn } from "@/lib/utils"

export function TaskView({ task }: { task: MockTask }) {
  const project = findProject(task.projectId)
  const channel = projectChannels(task.projectId)[0]
  const done = task.subtasks.filter((s) => s.done).length

  return (
    <>
      <PaneHeader
        crumbs={[
          <Link
            key="project"
            to="/modes/collaboration"
            search={{ view: "project", id: task.projectId }}
            className="truncate text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            {project?.name}
          </Link>,
          <span key="task" className="truncate font-medium">
            {task.title}
          </span>,
        ]}
        actions={
          <Button variant="ghost" size="icon-sm" aria-label="Task options">
            <IconDots className="size-4" />
          </Button>
        }
      />

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <PaneBody>
          <h1 className="max-w-[50ch] text-lg font-semibold text-balance">
            {task.title}
          </h1>

          <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-[13px] font-medium">
                <TaskStatusIcon status={task.status} />
                {STATUS_LABEL[task.status]}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Assignee</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-[13px] font-medium">
                <AssigneeAvatar name={task.assignee} />
                {task.assignee}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Due</dt>
              <dd className="mt-1 text-[13px] font-medium tabular-nums">
                {task.due}
              </dd>
            </div>
          </dl>

          <p className="mt-6 max-w-[70ch] text-sm text-pretty text-muted-foreground">
            {task.note}
          </p>

          {task.subtasks.length > 0 && (
            <>
              <h2 className="mt-8 flex items-center gap-2 text-[13px] font-medium">
                Subtasks
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {done}/{task.subtasks.length}
                </span>
              </h2>
              <ul role="list" className="mt-1">
                {task.subtasks.map((subtask) => (
                  <li
                    key={subtask.id}
                    className="flex h-8 items-center gap-2.5 px-2 text-[13px]"
                  >
                    <TaskStatusIcon status={subtask.done ? "done" : "todo"} />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        subtask.done && "text-muted-foreground"
                      )}
                    >
                      {subtask.title}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {channel !== undefined && (
            <Link
              to="/modes/collaboration"
              search={{ view: "channel", id: channel.id }}
              className="mt-8 flex h-9 w-fit items-center gap-2 rounded-lg px-2 text-[13px] text-muted-foreground outline-none hover:bg-elevate hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <IconMessage2 className="size-4 shrink-0" />
              Discuss in #{channel.name}
            </Link>
          )}
        </PaneBody>
      </ScrollArea>
    </>
  )
}
