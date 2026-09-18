/**
 * The strip tucked under the composer, naming where the session will land, read
 * outside in: the project it belongs to, then the branch it starts from.
 *
 * The branch chip stays a live switcher once a session exists — a running
 * session is no reason to lock the window out of its own git surface.
 *
 * It wires itself from the repo queries instead of taking a dozen props, since
 * the switcher wants its whole git surface and the composer has no reason to
 * carry it.
 */
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { ProjectPicker } from "@/interactions/workspace/components/project-picker";
import { activeRepo } from "@reviewer/core/workspace";
import { useWorkspaceActions } from "@/interactions/workspace/adapters/workspace.hook.adapter";
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter";
import {
  useBranches,
  useProjectBranches,
  useRemoteBranches,
  useRepo,
  useWorkspace,
} from "@/lib/queries";

export function SessionContextBar() {
  const navigate = useNavigate();
  const repo = useRepo();
  const workspace = useWorkspace();
  const workspaceActions = useWorkspaceActions();
  const projectBranchList = useProjectBranches();
  /** Make a root current before a menu action runs in it. */
  const followRepo = (repoPath: string) =>
    workspaceActions.followRepo(repoPath, workspace.data?.current ?? null);
  const branches = useBranches();
  const remoteBranches = useRemoteBranches();
  const git = useGitActions();
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  const current = repo.data ?? null;

  // Tucked under the composer by its full corner radius, so the strip's own
  // square top corners never show through where the composer's curve away.
  return (
    <div className="composer-foot -mt-4 flex items-center gap-1 border border-t-0 bg-elevate px-2 pt-5 pb-1.5">
      <ProjectPicker
        workspace={workspace.data}
        open={projectPickerOpen}
        onOpenChange={setProjectPickerOpen}
        side="top"
      />
      <BranchSwitcher
        current={current?.currentBranch ?? null}
        branches={branches.data ?? []}
        remoteBranches={remoteBranches.data ?? []}
        busy={false}
        onCheckout={(b) => void git.checkout(b)}
        onCheckoutAndUpdate={(b) => void git.checkoutAndUpdate(b)}
        onCreateBranch={(name, sp) => void git.createBranch(name, sp)}
        onCompare={(base, head) =>
          void navigate({
            to: "/modes/code/browse/range",
            search: { base, head },
          })
        }
        onMerge={(b) => void git.merge(b)}
        onRebase={(o) => void git.rebase(o)}
        onRenameBranch={(from, to) => void git.renameBranch(from, to)}
        onDeleteBranch={(name) => void git.deleteBranch(name)}
        repos={projectBranchList.data?.repos}
        currentRepo={activeRepo(workspace.data ?? { repos: [], current: null })}
        onFollowRepo={followRepo}
        onFetch={() => void git.fetch()}
        onPush={() => void git.push()}
      />
    </div>
  );
}
