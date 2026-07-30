/**
 * WorkspaceShell — the layout for the workspace feature pages (chats, docs,
 * tasks/settings). It mirrors AppShell's frame — the same title bar over a
 * bordered content panel and the shared bottom dock. Code mode keeps the repo
 * picker and branch switcher; collaboration mode drops both, along with the
 * dock. Each feature page renders its own header and body into the `<Outlet />`.
 */
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router"
import { useState } from "react"
import { BranchSwitcher } from "@/components/layout/branch-switcher"
import { GitBottomDock } from "@/components/layout/git-bottom-dock"
import { ModeRail } from "@/components/layout/mode-rail"
import { ModeSelector } from "@/components/layout/mode-selector"
import { RepoPicker } from "@/components/repo-picker"
import { WorkspacePicker } from "@/interactions/collaboration/components/workspace-picker"
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter"
import { isDesktop } from "@/lib/desktop"
import {
  useBranches,
  useRemoteBranches,
  useRepo,
  useWorkspace,
} from "@/lib/queries"
import { useUiPrefs } from "@/lib/ui-prefs"
import { cn } from "@/lib/utils"
import { activeWorkMode } from "@/lib/work-mode"

export function WorkspaceShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const repo = useRepo()
  const workspace = useWorkspace()
  const branches = useBranches()
  const remoteBranches = useRemoteBranches()
  const git = useGitActions()
  const prefs = useUiPrefs()
  const [pickerOpen, setPickerOpen] = useState(false)

  const current = workspace.data?.current ?? null
  const isSettings = pathname.startsWith("/settings")
  // Collaboration mode hides the git chrome — no branch switcher, no dock.
  const collaborating =
    activeWorkMode(pathname, prefs.workMode) === "collaboration"

  return (
    <div className="flex h-svh w-full overflow-hidden text-foreground">
      {!collaborating && <ModeRail />}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* In desktop this doubles as the draggable title bar (clusters opt out). */}
        <header
          className={cn(
            "flex h-10 shrink-0 items-center gap-2 px-2",
            isDesktop && "pl-10 [-webkit-app-region:drag]"
          )}
        >
          <div className="[-webkit-app-region:no-drag]">
            <ModeSelector />
          </div>
          {collaborating && (
            <div className="[-webkit-app-region:no-drag]">
              <WorkspacePicker />
            </div>
          )}
          {!collaborating && (
            <div className="[-webkit-app-region:no-drag]">
              <RepoPicker
                repo={repo.data ?? null}
                workspace={workspace.data}
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                onChosen={() => {}}
              />
            </div>
          )}
          {current !== null && !collaborating && (
            <div className="[-webkit-app-region:no-drag]">
              <BranchSwitcher
                current={repo.data?.currentBranch ?? null}
                branches={branches.data ?? []}
                remoteBranches={remoteBranches.data ?? []}
                busy={false}
                onCheckout={(b) => void git.checkout(b)}
                onCheckoutAndUpdate={(b) => void git.checkoutAndUpdate(b)}
                onCreateBranch={(name, sp) => void git.createBranch(name, sp)}
                onCompare={(base, head) =>
                  void navigate({ to: "/browse/range", search: { base, head } })
                }
                onMerge={(b) => void git.merge(b)}
                onRebase={(o) => void git.rebase(o)}
                onRenameBranch={(from, to) => void git.renameBranch(from, to)}
                onDeleteBranch={(name) => void git.deleteBranch(name)}
                onFetch={() => void git.fetch()}
                onPull={() => void git.pull()}
                onPush={() => void git.push()}
              />
            </div>
          )}
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-lg border-t border-l">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {current === null && !isSettings ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-sm">
                <div className="font-medium">No repository selected</div>
                <div className="text-muted-foreground">
                  Open one from the repo picker above to use this workspace.
                </div>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
          {current !== null && !collaborating && <GitBottomDock />}
        </div>
      </div>
    </div>
  )
}
