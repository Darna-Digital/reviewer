import { BranchSwitcher } from "@/components/layout/branch-switcher"
import { ModeSelector } from "@/components/layout/mode-selector"
import { DiffStyleToggle } from "@/components/layout/diff-style-toggle"
import { RepoPicker } from "@/components/repo-picker"
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
        // empty regions drag the window (interactive clusters opt back out
        // below). The left pad clears the macOS traffic lights.
        isDesktop && "pl-20 [-webkit-app-region:drag]"
      )}
    >
      <div className="[-webkit-app-region:no-drag]">
        <ModeSelector />
      </div>

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
          <DiffStyleToggle
            value={diffStyle}
            onChange={props.onDiffStyleChange}
          />
        )}
      </div>
    </header>
  )
}
