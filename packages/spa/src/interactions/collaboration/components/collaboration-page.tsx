/**
 * CollaborationPage — the prototype surface behind the mode selector's
 * Collaboration entry. The sidebar picks what the right pane shows through the
 * URL; everything it renders comes from `collaboration.mock`.
 */
import { useSearch } from "@tanstack/react-router"
import { ChannelView } from "@/interactions/collaboration/components/channel-view"
import { DocsView } from "@/interactions/collaboration/components/docs-view"
import { CollaborationSidebar } from "@/interactions/collaboration/components/collaboration-sidebar"
import { PeopleView } from "@/interactions/collaboration/components/people-view"
import { ProjectView } from "@/interactions/collaboration/components/project-view"
import { TaskListView } from "@/interactions/collaboration/components/task-list-view"
import { TaskView } from "@/interactions/collaboration/components/task-view"
import {
  DEFAULT_ID,
  DEFAULT_VIEW,
  findChannel,
  findProject,
  findTask,
} from "@/interactions/collaboration/data/collaboration.mock"

function NothingSelected() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-sm">
      <p className="font-medium">Nothing selected</p>
      <p className="text-muted-foreground">
        Pick a project, task, or channel from the sidebar.
      </p>
    </div>
  )
}

export function CollaborationPage() {
  const search = useSearch({ strict: false })
  const view = search.view ?? DEFAULT_VIEW
  const id = search.id ?? DEFAULT_ID

  const project = view === "project" ? findProject(id) : undefined
  const taskListProject = view === "tasks" ? findProject(id) : undefined
  const docsProject = view === "docs" ? findProject(id) : undefined
  const channel = view === "channel" ? findChannel(id) : undefined
  const task = view === "task" ? findTask(id) : undefined

  return (
    <div className="flex h-full min-h-0">
      <CollaborationSidebar />

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {project !== undefined ? (
          <ProjectView project={project} />
        ) : taskListProject !== undefined ? (
          <TaskListView project={taskListProject} />
        ) : docsProject !== undefined ? (
          <DocsView project={docsProject} />
        ) : channel !== undefined ? (
          <ChannelView channel={channel} />
        ) : task !== undefined ? (
          <TaskView task={task} />
        ) : view === "agents" || view === "members" ? (
          <PeopleView kind={view} />
        ) : (
          <NothingSelected />
        )}
      </section>
    </div>
  )
}
