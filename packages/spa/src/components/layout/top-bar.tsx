import { IconColumns, IconBaselineDensityMedium } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { BranchSwitcher } from "@/components/layout/branch-switcher"
import { RepoPicker } from "@/components/repo-picker"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { isDesktop } from "@/lib/desktop"
import type { BranchInfo, RemoteBranchInfo, RepoInfo } from "@byconvo/core/repo"
import type { WorkspaceInfo } from "@byconvo/core/workspace"
import type { DiffStyle } from "@/lib/ui-prefs"

interface TopBarProps {
  repo: RepoInfo | null
  workspace: WorkspaceInfo | undefined
  branches: ReadonlyArray<BranchInfo>
  remoteBranches: ReadonlyArray<RemoteBranchInfo>
  contextLabel: string
  diffStyle: DiffStyle
  showDiffStyleToggle: boolean
  busy: boolean
  pickerOpen: boolean
  onPickerOpenChange: (open: boolean) => void
  onDiffStyleChange: (style: DiffStyle) => void
  onCheckout: (branch: string) => void
  onCheckoutAndUpdate: (branch: string) => void
  onCreateBranch: (name: string, startPoint: string | null) => void
  onCompare: (base: string, head: string) => void
  onMerge: (branch: string) => void
  onRebase: (onto: string) => void
  onRenameBranch: (from: string, to: string) => void
  onDeleteBranch: (name: string) => void
  onFetch: () => void
  onPush: () => void
  onPull: () => void
}

export function TopBar(props: TopBarProps) {
  const {
    repo,
    branches,
    remoteBranches,
    diffStyle,
    showDiffStyleToggle,
    busy,
  } = props
  const current = repo?.currentBranch ?? null

  return (
    <header
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 px-2",
        // In the desktop shell the bar doubles as the window's title bar and lets
        // empty regions drag the window (interactive clusters opt back out below).
        // The rail to the left reserves the bulk of the traffic-light strip; this
        // small left pad just clears the lights' overflow past the rail's edge.
        isDesktop && "pl-10 [-webkit-app-region:drag]"
      )}
    >
      {/* Repo chip — opens the recents + folder-browser dropdown */}
      <div className="[-webkit-app-region:no-drag]">
        <RepoPicker
          repo={repo}
          workspace={props.workspace}
          open={props.pickerOpen}
          onOpenChange={props.onPickerOpenChange}
        />
      </div>

      {/* Branch switcher */}
      {repo !== null && (
        <div className="[-webkit-app-region:no-drag]">
          <BranchSwitcher
            current={current}
            branches={branches}
            remoteBranches={remoteBranches}
            busy={busy}
            onCheckout={props.onCheckout}
            onCheckoutAndUpdate={props.onCheckoutAndUpdate}
            onCreateBranch={props.onCreateBranch}
            onCompare={props.onCompare}
            onMerge={props.onMerge}
            onRebase={props.onRebase}
            onFetch={props.onFetch}
            onPull={props.onPull}
            onPush={props.onPush}
            onRenameBranch={props.onRenameBranch}
            onDeleteBranch={props.onDeleteBranch}
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-1 [-webkit-app-region:no-drag]">
        {showDiffStyleToggle && (
          <div className="flex items-center rounded-md border p-0.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant={diffStyle === "split" ? "secondary" : "ghost"}
                    size="icon-xs"
                    onClick={() => props.onDiffStyleChange("split")}
                    aria-label="Split diff"
                  />
                }
              >
                <IconColumns />
              </TooltipTrigger>
              <TooltipContent>Split diff</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant={diffStyle === "unified" ? "secondary" : "ghost"}
                    size="icon-xs"
                    onClick={() => props.onDiffStyleChange("unified")}
                    aria-label="Unified diff"
                  />
                }
              >
                <IconBaselineDensityMedium />
              </TooltipTrigger>
              <TooltipContent>Unified diff</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </header>
  )
}
