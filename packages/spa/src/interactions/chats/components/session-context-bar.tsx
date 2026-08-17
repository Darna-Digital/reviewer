/**
 * The composer's second level — the strip tucked under it naming where the
 * session will land, read outside in: the project/runtime, then the branch it
 * is on. The branch reuses the toolbar's own switcher, so switching from here is
 * the same switch, with the same menus, made where the question is asked.
 *
 * It wires itself from the repo queries instead of taking a dozen props, since
 * the switcher wants its whole git surface and the composer has no reason to
 * carry it.
 */
import { useNavigate } from "@tanstack/react-router";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { DeviceSwitcher } from "@/components/layout/device-switcher";
import { activeRepo, folderName } from "@byconvo/core/workspace";
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

  const current = repo.data ?? null;

  return (
    <div className="-mt-3 flex items-center gap-1 rounded-b-lg border border-t-0 bg-elevate px-2 pt-4 pb-1.5">
      <DeviceSwitcher
        device={workspace.data?.device}
        project={
          workspace.data?.project === null ||
          workspace.data?.project === undefined
            ? undefined
            : folderName(workspace.data.project)
        }
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
