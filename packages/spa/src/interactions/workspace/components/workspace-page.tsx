/**
 * The workspace: projects down the left, and one project's tasks, docs or
 * labels beside them. Opening a task swaps the list for that task's own page.
 *
 * Which project, which tab and which task are in the URL, so a view is linkable
 * and the back button does what it looks like it does. Everything else — the
 * filters, what is expanded — is view state and stays in the component.
 */
import { IconPlus, IconSearch, IconTag, IconX } from "@tabler/icons-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import type { MemberRole } from "@byconvo/core/identity"
import type { Task } from "@byconvo/core/tasks"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { TabsSubtle, TabsSubtleItem } from "@/components/ui/tabs-subtle"
import { projectsCollection } from "@/lib/central/collections"
import { noFilters } from "../interfaces/workspace.interfaces"
import {
  useProject,
  useProjects,
  useWorkspaceTasks,
} from "../adapters/workspace.hook.adapter"
import { DocsPanel } from "./docs-panel"
import { LabelsPanel } from "./labels-panel"
import { ProjectGlyph } from "./task-glyphs"
import { TaskDetail } from "./task-detail"
import { TaskList } from "./task-list"
import { WorkspaceNavButton, WorkspaceSidebar } from "./workspace-sidebar"

export const WORKSPACE_TABS = ["tasks", "docs", "labels"] as const
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number]

export interface WorkspacePageProps {
  projectId: string | null
  tab: WorkspaceTab
  taskId: string | null
  role: MemberRole | null
  onNavigate: (projectId: string, tab: WorkspaceTab) => void
  onOpenTask: (taskId: string | null) => void
  onManageMembers: () => void
}

/** The project pane. Split out so it only mounts once a project is chosen. */
function ProjectPane({
  projectId,
  tab,
  taskId,
  role,
  onTab,
  onOpenTask,
  nav,
}: {
  projectId: string
  tab: WorkspaceTab
  taskId: string | null
  role: MemberRole | null
  onTab: (tab: WorkspaceTab) => void
  onOpenTask: (taskId: string | null) => void
  /** The rail's mobile trigger, rendered in whichever header is on screen. */
  nav: React.ReactNode
}) {
  const project = useProject(projectId)
  const tasks = useWorkspaceTasks({ projectId })

  const open = useMemo(
    () => tasks.tasks.find((task) => task.id === taskId) ?? null,
    [tasks.tasks, taskId]
  )

  const tabIndex = WORKSPACE_TABS.indexOf(tab)
  const isFiltered =
    tasks.filters.search.length > 0 || tasks.filters.labelIds.length > 0

  // A task is its own page, so it replaces the list rather than sitting beside
  // it — the breadcrumbs are what leads back.
  if (tab === "tasks" && open !== null) {
    return (
      <TaskDetail
        key={open.id}
        nav={nav}
        task={open}
        projectName={project?.name ?? "Project"}
        labels={tasks.labelsOf(open)}
        projectLabels={tasks.labels}
        subTasks={tasks.childrenOf(open.id)}
        ancestors={tasks.ancestorsOf(open.id)}
        role={role}
        onClose={() => onOpenTask(null)}
        onStatus={tasks.setStatus}
        onPriority={tasks.setPriority}
        onToggleLabel={tasks.toggleLabel}
        onRename={tasks.rename}
        onDescribe={tasks.describe}
        onRemove={(id) => {
          onOpenTask(null)
          tasks.remove(id)
        }}
        onCreateSubTask={(title) => tasks.create(title, open.status, open.id)}
        onOpen={(task) => onOpenTask(task.id)}
      />
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-foreground/10 px-3 sm:gap-3">
        {nav}
        {project !== null && (
          <div className="flex min-w-0 shrink items-center gap-2">
            <ProjectGlyph name={project.name} color={project.color} />
            {/* Narrow, the key alone identifies the project and the name is what
                there is no room for. */}
            <h1 className="min-w-0 truncate text-base font-medium max-sm:hidden sm:text-sm">
              {project.name}
            </h1>
            <p className="shrink-0 font-mono text-sm text-muted-foreground sm:text-xs">
              {project.key}
            </p>
          </div>
        )}
        <TabsSubtle
          className="shrink-0"
          selectedIndex={tabIndex < 0 ? 0 : tabIndex}
          onSelect={(index) => onTab(WORKSPACE_TABS[index])}
          idPrefix="workspace"
          aria-label="Project sections"
        >
          <TabsSubtleItem index={0} label="Tasks" />
          <TabsSubtleItem index={1} label="Docs" />
          <TabsSubtleItem index={2} label="Labels" />
        </TabsSubtle>

        {tab === "tasks" && (
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
            <div className="relative w-full max-w-56 min-w-24">
              <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 shrink-0 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search tasks"
                placeholder="Search tasks"
                value={tasks.filters.search}
                onChange={(event) =>
                  tasks.setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                className="h-8 pr-8 pl-8"
              />
              {tasks.filters.search.length > 0 && (
                <button
                  type="button"
                  aria-label="Clear the search"
                  onClick={() =>
                    tasks.setFilters((current) => ({ ...current, search: "" }))
                  }
                  className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                >
                  <IconX className="size-3.5 shrink-0" />
                </button>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    data-icon="inline-start"
                    className="max-lg:hidden"
                  />
                }
              >
                <IconTag />
                Labels
                {tasks.filters.labelIds.length > 0 &&
                  ` · ${tasks.filters.labelIds.length}`}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {tasks.labels.length === 0 ? (
                  <DropdownMenuCheckboxItem checked={false} disabled>
                    No labels in this project
                  </DropdownMenuCheckboxItem>
                ) : (
                  tasks.labels.map((label) => (
                    <DropdownMenuCheckboxItem
                      key={label.id}
                      checked={tasks.filters.labelIds.includes(label.id)}
                      onClick={() =>
                        tasks.setFilters((current) => ({
                          ...current,
                          labelIds: current.labelIds.includes(label.id)
                            ? current.labelIds.filter((id) => id !== label.id)
                            : [...current.labelIds, label.id],
                        }))
                      }
                    >
                      {label.name}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <label className="flex cursor-pointer items-center gap-2 text-base text-muted-foreground max-lg:hidden sm:text-sm">
              <Checkbox
                checked={tasks.filters.hiddenStatuses.length > 0}
                onCheckedChange={(checked) =>
                  tasks.setFilters((current) => ({
                    ...current,
                    hiddenStatuses: checked ? ["done", "canceled"] : [],
                  }))
                }
              />
              Hide completed
            </label>
          </div>
        )}
      </header>

      {tab === "tasks" && (
        <TaskList
          groups={tasks.groups}
          labelsOf={tasks.labelsOf}
          selectedId={taskId}
          expandedTasks={tasks.expanded}
          onSelect={(task: Task) => onOpenTask(task.id)}
          onToggleExpanded={tasks.toggleExpanded}
          onCreate={tasks.create}
          isLoading={tasks.isLoading}
          isFiltered={isFiltered}
          onClearFilters={() => tasks.setFilters(noFilters)}
        />
      )}

      {tab === "docs" && <DocsPanel projectId={projectId} />}

      {tab === "labels" && (
        <LabelsPanel
          projectId={projectId}
          labels={tasks.labels}
          tasks={tasks.tasks}
        />
      )}
    </div>
  )
}

export function WorkspacePage({
  projectId,
  tab,
  taskId,
  role,
  onNavigate,
  onOpenTask,
  onManageMembers,
}: WorkspacePageProps) {
  const { projects, isLoading, isError } = useProjects()

  // With no project in the URL, open the first one there is — an empty middle
  // pane is a worse first screen than the workspace's actual contents.
  const active = projectId ?? (projects.length > 0 ? projects[0].id : null)

  const createProject = (name: string) => {
    try {
      projectsCollection().insert({
        id: `pending-${crypto.randomUUID()}`,
        // The server derives the key and settles collisions.
        key: "…",
        name: name.trim(),
        description: "",
        color: "blue",
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not create the project"
      )
    }
  }

  const railProps = {
    projects,
    activeProjectId: active,
    onSelectProject: (id: string) => onNavigate(id, tab),
    onCreateProject: createProject,
    onManageMembers,
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <WorkspaceSidebar {...railProps} />
      {isError ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-base font-medium sm:text-sm">
              Could not reach the workspace server
            </p>
            <p className="max-w-[48ch] text-base/6 text-pretty text-muted-foreground sm:text-sm/6">
              Projects, tasks and docs live on the central server. Check that it
              is running, then reload.
            </p>
          </div>
        </div>
      ) : active === null ? (
        <ProjectsEmptyState isLoading={isLoading} onCreate={createProject} />
      ) : (
        <ProjectPane
          key={active}
          projectId={active}
          tab={tab}
          taskId={taskId}
          role={role}
          onTab={(next) => onNavigate(active, next)}
          onOpenTask={onOpenTask}
          nav={<WorkspaceNavButton {...railProps} />}
        />
      )}
    </div>
  )
}

/**
 * The first screen of a brand-new workspace. It carries the create control
 * itself rather than pointing at the sidebar's `+`, so the empty state is not a
 * dead end.
 */
function ProjectsEmptyState({
  isLoading,
  onCreate,
}: {
  isLoading: boolean
  onCreate: (name: string) => void
}) {
  const [name, setName] = useState("")

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-base text-muted-foreground sm:text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex flex-col items-center gap-1 rounded-3xl border border-dashed border-foreground/15 px-6 py-14 text-center">
        <IconPlus className="size-4 shrink-0 text-muted-foreground" />
        <p className="mt-2 text-base font-medium sm:text-sm">No projects yet</p>
        <p className="max-w-[48ch] text-base/6 text-pretty text-muted-foreground sm:text-sm/6">
          A project holds its own tasks, docs and labels, and gives them a key
          like BYC-1.
        </p>
        <form
          className="mt-4 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim().length === 0) return
            onCreate(name)
            setName("")
          }}
        >
          <Input
            value={name}
            placeholder="Project name"
            aria-label="Project name"
            onChange={(event) => setName(event.target.value)}
            className="w-56"
          />
          <Button
            type="submit"
            size="default"
            disabled={name.trim().length === 0}
          >
            Create project
          </Button>
        </form>
      </div>
    </div>
  )
}
