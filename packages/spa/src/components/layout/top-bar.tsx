import { BranchSwitcher } from "@/components/layout/branch-switcher";
// Only code mode is offered for now, so the mode chip stays parked.
// import { ModeSelector } from "@/components/layout/mode-selector";
import { DiffStyleToggle } from "@/components/layout/diff-style-toggle";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { RepoPicker } from "@/components/repo-picker";
import { isDesktop } from "@/lib/desktop";
import type {
  BranchInfo,
  RemoteBranchInfo,
  RepoInfo,
} from "@byconvo/core/repo";
import type { WorkspaceInfo } from "@byconvo/core/workspace";
import type { DiffStyle } from "@/lib/ui-prefs";

interface TopBarProps {
  repo: RepoInfo | null;
  workspace: WorkspaceInfo | undefined;
  branches: ReadonlyArray<BranchInfo>;
  remoteBranches: ReadonlyArray<RemoteBranchInfo>;
  diffStyle: DiffStyle;
  showDiffStyleToggle: boolean;
  busy: boolean;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onDiffStyleChange: (style: DiffStyle) => void;
  onCheckout: (branch: string) => void;
  onCheckoutAndUpdate: (branch: string) => void;
  onCreateBranch: (name: string, startPoint: string | null) => void;
  onCompare: (base: string, head: string) => void;
  onMerge: (branch: string) => void;
  onRebase: (onto: string) => void;
  onRenameBranch: (from: string, to: string) => void;
  onDeleteBranch: (name: string) => void;
  onFetch: () => void;
  onPush: () => void;
  onPull: () => void;
}

export function TopBar(props: TopBarProps) {
  const {
    repo,
    branches,
    remoteBranches,
    diffStyle,
    showDiffStyleToggle,
    busy,
  } = props;
  const current = repo?.currentBranch ?? null;

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 px-2">
      {/* In the native shell the window bar above carries this. */}
      {!isDesktop && <SidebarToggle />}
      {/* <ModeSelector /> */}

      {/* Repo chip — opens the recents + folder-browser dropdown */}
      <RepoPicker
        repo={repo}
        workspace={props.workspace}
        open={props.pickerOpen}
        onOpenChange={props.onPickerOpenChange}
      />

      {/* Branch switcher */}
      {repo !== null && (
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
      )}

      <div className="ml-auto flex items-center gap-1">
        {showDiffStyleToggle && (
          <DiffStyleToggle
            value={diffStyle}
            onChange={props.onDiffStyleChange}
          />
        )}
      </div>
    </header>
  );
}
