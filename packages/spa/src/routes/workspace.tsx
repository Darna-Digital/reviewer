/**
 * The workspace surface.
 *
 * It gets its own top-level route rather than joining the `_conversations` layout,
 * because it is the other half of the app rather than another mode within the
 * git-review one: no repository, no bottom dock, its own sidebar. The project
 * and tab live in the search params so a view can be linked and the back button
 * behaves.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { SurfaceSwitch } from "@/components/layout/surface-switch"
import { isDesktop } from "@/lib/desktop"
import { cn } from "@/lib/utils"
import {
  WORKSPACE_TABS,
  WorkspacePage,
  type WorkspaceTab,
} from "@/interactions/workspace/components/workspace-page"
import { AuthGate } from "@/interactions/auth/components/auth-gate"
import { useViewerRole } from "@/interactions/auth/adapters/auth.hook.adapter"

interface WorkspaceSearch {
  readonly project?: string
  readonly tab?: WorkspaceTab
}

export const Route = createFileRoute("/workspace")({
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => {
    const tab = search["tab"]
    const project = search["project"]
    return {
      ...(typeof project === "string" && project.length > 0 ? { project } : {}),
      ...(WORKSPACE_TABS.includes(tab as WorkspaceTab)
        ? { tab: tab as WorkspaceTab }
        : {}),
    }
  },
  component: WorkspaceRoute,
})

function WorkspaceRoute() {
  const { project, tab } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const role = useViewerRole()

  return (
    <div className="flex h-svh w-full flex-col overflow-hidden text-foreground">
      <header
        className={cn(
          "flex h-10 shrink-0 items-center gap-2 px-2",
          isDesktop && "pl-20 [-webkit-app-region:drag]"
        )}
      >
        <SurfaceSwitch />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-lg border-t border-l">
        <AuthGate>
          <WorkspacePage
            projectId={project ?? null}
            tab={tab ?? "issues"}
            role={role}
            onNavigate={(nextProject, nextTab) =>
              void navigate({
                search: { project: nextProject, tab: nextTab },
                replace: true,
              })
            }
            onManageMembers={() => void navigate({ to: "/members" })}
          />
        </AuthGate>
      </div>
    </div>
  )
}
