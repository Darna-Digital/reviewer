/**
 * The workspace: projects down the left, one project's issues, docs or labels
 * in the middle, and the open issue on the right.
 *
 * Which project and which tab are in the URL, so a view is linkable and the
 * back button does what it looks like it does. Everything else — the filters,
 * what is expanded — is view state and stays in the component.
 */
import { IconSearch, IconTag, IconX } from "@tabler/icons-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import type { MemberRole } from "@byconvo/core/identity"
import type { Task } from "@byconvo/core/tasks"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { TabsSubtle, TabsSubtleItem } from "@/components/ui/tabs-subtle"
import { projectsCollection } from "@/lib/central/collections"
import {
  useProject,
  useProjects,
  useWorkspaceIssues,
} from "../adapters/workspace.hook.adapter"
import { DocsPanel } from "./docs-panel"
import { IssueDetail } from "./issue-detail"
import { IssueList } from "./issue-list"
import { LabelsPanel } from "./labels-panel"
import { ProjectGlyph } from "./issue-glyphs"
import { WorkspaceSidebar } from "./workspace-sidebar"

export const WORKSPACE_TABS = ["issues", "docs", "labels"] as const
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number]

export interface WorkspacePageProps {
  projectId: string | null
  tab: WorkspaceTab
  role: MemberRole | null
  onNavigate: (projectId: string, tab: WorkspaceTab) => void
  onManageMembers: () => void
}

/** The project pane. Split out so it only mounts once a project is chosen. */
function ProjectPane({
  projectId,
  tab,
  role,
  onTab,
}: {
  projectId: string
  tab: WorkspaceTab
  role: MemberRole | null
  onTab: (tab: WorkspaceTab) => void
}) {
  const project = useProject(projectId)
  const issues = useWorkspaceIssues({ projectId })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = useMemo(
    () => issues.tasks.find((task) => task.id === selectedId) ?? null,
    [issues.tasks, selectedId]
  )

  const tabIndex = WORKSPACE_TABS.indexOf(tab)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
        {project !== null && (
          <>
            <ProjectGlyph name={project.name} color={project.color} />
            <span className="text-[13px] font-medium">{project.name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {project.key}
            </span>
          </>
        )}
        <div className="ml-3">
          <TabsSubtle
            selectedIndex={tabIndex < 0 ? 0 : tabIndex}
            onSelect={(index) => onTab(WORKSPACE_TABS[index])}
            idPrefix="workspace"
            aria-label="Project sections"
          >
            <TabsSubtleItem index={0} label="Issues" />
            <TabsSubtleItem index={1} label="Docs" />
            <TabsSubtleItem index={2} label="Labels" />
          </TabsSubtle>
        </div>
      </header>

      {tab === "issues" && (
        <>
          <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
            <div className="relative max-w-xs min-w-0 flex-1">
              <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search issues"
                placeholder="Search issues"
                value={issues.filters.search}
                onChange={(event) =>
                  issues.setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                className="h-7 rounded-md pr-7 pl-8"
              />
              {issues.filters.search.length > 0 && (
                <button
                  type="button"
                  aria-label="Clear the search"
                  onClick={() =>
                    issues.setFilters((current) => ({ ...current, search: "" }))
                  }
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <IconX className="size-3" />
                </button>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="sm" data-icon="inline-start" />
                }
              >
                <IconTag />
                Labels
                {issues.filters.labelIds.length > 0 &&
                  ` · ${issues.filters.labelIds.length}`}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {issues.labels.length === 0 ? (
                  <DropdownMenuCheckboxItem checked={false} disabled>
                    No labels in this project
                  </DropdownMenuCheckboxItem>
                ) : (
                  issues.labels.map((label) => (
                    <DropdownMenuCheckboxItem
                      key={label.id}
                      checked={issues.filters.labelIds.includes(label.id)}
                      onClick={() =>
                        issues.setFilters((current) => ({
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

            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={issues.filters.hiddenStatuses.length > 0}
                onChange={(event) =>
                  issues.setFilters((current) => ({
                    ...current,
                    hiddenStatuses: event.target.checked
                      ? ["done", "canceled"]
                      : [],
                  }))
                }
                className="size-3 accent-current"
              />
              Hide completed
            </label>
          </div>

          <div className="flex min-h-0 flex-1">
            <IssueList
              groups={issues.groups}
              labelsOf={issues.labelsOf}
              selectedId={selectedId}
              expandedIssues={issues.expanded}
              onSelect={(task: Task) => setSelectedId(task.id)}
              onToggleExpanded={issues.toggleExpanded}
              onCreate={issues.create}
              isLoading={issues.isLoading}
            />
            {selected !== null && (
              <IssueDetail
                task={selected}
                labels={issues.labelsOf(selected)}
                projectLabels={issues.labels}
                subIssues={issues.childrenOf(selected.id)}
                role={role}
                onClose={() => setSelectedId(null)}
                onStatus={issues.setStatus}
                onPriority={issues.setPriority}
                onToggleLabel={issues.toggleLabel}
                onRename={issues.rename}
                onDescribe={issues.describe}
                onRemove={(id) => {
                  setSelectedId(null)
                  issues.remove(id)
                }}
                onCreateSubIssue={(title) =>
                  issues.create(title, selected.status, selected.id)
                }
                onOpen={(task) => setSelectedId(task.id)}
              />
            )}
          </div>
        </>
      )}

      {tab === "docs" && <DocsPanel projectId={projectId} />}

      {tab === "labels" && (
        <LabelsPanel
          projectId={projectId}
          labels={issues.labels}
          tasks={issues.tasks}
        />
      )}
    </div>
  )
}

export function WorkspacePage({
  projectId,
  tab,
  role,
  onNavigate,
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

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <WorkspaceSidebar
        projects={projects}
        activeProjectId={active}
        onSelectProject={(id) => onNavigate(id, tab)}
        onCreateProject={createProject}
        onManageMembers={onManageMembers}
      />
      {isError ? (
        <div className="flex flex-1 items-center justify-center text-sm text-destructive">
          Could not reach the workspace server.
        </div>
      ) : active === null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-sm">
          <div className="font-medium">
            {isLoading ? "Loading…" : "No projects yet"}
          </div>
          {!isLoading && (
            <div className="text-muted-foreground">
              Create one from the sidebar to start filing issues.
            </div>
          )}
        </div>
      ) : (
        <ProjectPane
          key={active}
          projectId={active}
          tab={tab}
          role={role}
          onTab={(next) => onNavigate(active, next)}
        />
      )}
    </div>
  )
}
