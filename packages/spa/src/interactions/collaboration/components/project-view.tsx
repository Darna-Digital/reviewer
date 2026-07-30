import { IconDots, IconHash } from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { AvatarStack } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AssigneeAvatar } from "@/interactions/collaboration/components/assignee-avatar"
import {
  PaneBody,
  PaneHeader,
} from "@/interactions/collaboration/components/pane-header"
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon"
import {
  projectChannels,
  projectTasks,
  STATUS_LABEL,
  STATUS_ORDER,
  UNASSIGNED,
  type MockProject,
} from "@/interactions/collaboration/data/collaboration.mock"

export function ProjectView({ project }: { project: MockProject }) {
  const tasks = projectTasks(project.id)
  const channels = projectChannels(project.id)
  const groups = STATUS_ORDER.map((status) => ({
    status,
    items: tasks.filter((t) => t.status === status),
  })).filter((group) => group.items.length > 0)
  const people = [
    ...new Set(tasks.map((t) => t.assignee).filter((a) => a !== UNASSIGNED)),
  ]

  return (
    <>
      <PaneHeader
        crumbs={[
          <span key="section" className="text-muted-foreground">
            Projects
          </span>,
          <span key="name" className="truncate font-medium">
            {project.name}
          </span>,
        ]}
        actions={
          <>
            <AvatarStack names={people} />
            <Button variant="ghost" size="icon-sm" aria-label="Project options">
              <IconDots className="size-4" />
            </Button>
          </>
        }
      />

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <PaneBody>
          <h1 className="text-lg font-semibold">{project.name}</h1>
          <p className="mt-1 max-w-[70ch] text-sm text-pretty text-muted-foreground">
            {project.summary}
          </p>

          <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <dt className="text-xs text-muted-foreground">Lead</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-[13px] font-medium">
                <AssigneeAvatar name={project.lead} />
                {project.lead}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Target</dt>
              <dd className="mt-1 text-[13px] font-medium tabular-nums">
                {project.target}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Open tasks</dt>
              <dd className="mt-1 text-[13px] font-medium tabular-nums">
                {tasks.filter((t) => t.status !== "done").length} of{" "}
                {tasks.length}
              </dd>
            </div>
          </dl>

          <h2 className="mt-8 text-[13px] font-medium">Tasks</h2>
          {groups.map((group) => (
            <section key={group.status} className="mt-4">
              <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                <TaskStatusIcon status={group.status} className="size-3.5" />
                {STATUS_LABEL[group.status]}
                <span className="tabular-nums">{group.items.length}</span>
              </div>
              <ul role="list" className="mt-1">
                {group.items.map((task) => (
                  <li key={task.id}>
                    <Link
                      to="/modes/collaboration"
                      search={{ view: "task", id: task.id }}
                      className="flex h-9 items-center gap-2.5 rounded-lg px-2 outline-none hover:bg-elevate focus-visible:ring-3 focus-visible:ring-ring/30"
                    >
                      <TaskStatusIcon status={task.status} />
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {task.title}
                      </span>
                      {task.subtasks.length > 0 && (
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {task.subtasks.filter((s) => s.done).length}/
                          {task.subtasks.length}
                        </span>
                      )}
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {task.due}
                      </span>
                      <AssigneeAvatar name={task.assignee} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <h2 className="mt-8 text-[13px] font-medium">Channels</h2>
          <ul role="list" className="mt-1">
            {channels.map((channel) => (
              <li key={channel.id}>
                <Link
                  to="/modes/collaboration"
                  search={{ view: "channel", id: channel.id }}
                  className="flex h-9 items-center gap-2.5 rounded-lg px-2 outline-none hover:bg-elevate focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <IconHash className="size-4 shrink-0 text-muted-foreground" />
                  <span className="shrink-0 text-[13px]">{channel.name}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {channel.topic}
                  </span>
                  {channel.unread > 0 && (
                    <span className="shrink-0 text-[0.6875rem] font-medium tabular-nums">
                      {channel.unread}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </PaneBody>
      </ScrollArea>
    </>
  )
}
