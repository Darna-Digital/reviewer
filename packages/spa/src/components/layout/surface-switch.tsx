/**
 * The Code / Workspace switch — the first control in the top bar, before the
 * repository picker.
 *
 * It sits before the picker deliberately: it chooses which of the two things
 * byconvo is you are looking at, and the repository only means something on one
 * side of it. Code is this machine's checkout — diffs, commits, pull requests,
 * agent threads. Workspace is the shared project management that outlives any
 * checkout, so the picker to its right goes quiet there.
 */
import { IconCode, IconLayoutKanban } from "@tabler/icons-react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { TabsSubtle, TabsSubtleItem } from "@/components/ui/tabs-subtle"

export type Surface = "code" | "workspace"

/** The paths that belong to the workspace; everything else is code. */
const WORKSPACE_PATHS = ["/workspace", "/members", "/accept-invitation"]

export const surfaceForPath = (pathname: string): Surface =>
  WORKSPACE_PATHS.some((path) => pathname.startsWith(path))
    ? "workspace"
    : "code"

export function SurfaceSwitch() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const surface = surfaceForPath(pathname)

  return (
    <div className="[-webkit-app-region:no-drag]">
      <TabsSubtle
        selectedIndex={surface === "code" ? 0 : 1}
        onSelect={(index) => {
          const next: Surface = index === 0 ? "code" : "workspace"
          if (next === surface) return
          // Leaving the workspace returns to the review surface rather than
          // wherever you last were: /commit is what this tool opens on.
          void navigate({ to: next === "workspace" ? "/workspace" : "/commit" })
        }}
        idPrefix="surface"
        aria-label="Code or workspace"
      >
        <TabsSubtleItem index={0} icon={IconCode} label="Code" />
        <TabsSubtleItem index={1} icon={IconLayoutKanban} label="Workspace" />
      </TabsSubtle>
    </div>
  )
}
