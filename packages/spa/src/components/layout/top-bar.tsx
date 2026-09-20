import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { DiffStyleToggle } from "@/components/layout/diff-style-toggle";
import { ProjectPicker } from "@/interactions/workspace/components/project-picker";
import { SearchMenu } from "@/interactions/search/components/search-menu";
import type {
  BranchInfo,
  RemoteBranchInfo,
  RepoInfo,
} from "@reviewer/core/repo";
import type { WorkspaceInfo } from "@reviewer/core/workspace";
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
  /** Make `repoPath` current before acting in it; false when it failed. */
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
    <header className="flex h-9 shrink-0 items-center gap-2 px-2">
      {/* Project chip — opens the recents + folder-browser dropdown */}
      <ProjectPicker
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
          onPush={props.onPush}
          onRenameBranch={props.onRenameBranch}
          onDeleteBranch={props.onDeleteBranch}
        />
      )}

      <SearchMenu />

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
