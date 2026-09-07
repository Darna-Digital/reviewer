/**
 * The strip tucked under the composer, naming where the session will land, read
 * outside in: the project it belongs to, the branch it starts from, then the
 * machine it runs on.
 *
 * Where it runs comes last because it is the only one of the three that is a
 * choice about *this* prompt — the project and the branch are where you already
 * are, and picking the cloud says this particular piece of work should happen
 * away from them rather than in them.
 *
 * A session that already exists answers the same three questions as facts. It
 * ran where it ran, and the branch it is on is the one it was started on, which
 * is not necessarily the one this window happens to be showing — so those chips
 * stop being switchers and simply say so.
 *
 * It wires itself from the repo queries instead of taking a dozen props, since
 * the switcher wants its whole git surface and the composer has no reason to
 * carry it.
 */
import { useNavigate } from "@tanstack/react-router";
import { IconGitBranch, IconGitFork } from "@tabler/icons-react";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { DeviceSwitcher } from "@/components/layout/device-switcher";
import {
  CloudRepoPicker,
  RunTargetPicker,
} from "@/interactions/cloud/components/run-target-picker";
import { useCloudRunTarget } from "@/interactions/cloud/adapters/cloud.hook.adapter";
import {
  setCloudRepoId,
  setRunTarget,
} from "@/interactions/cloud/adapters/run-target.store";
import { activeRepo, folderName } from "@reviewer/core/workspace";
import { useWorkspaceActions } from "@/interactions/workspace/adapters/workspace.hook.adapter";
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter";
import {
  useBranches,
  useProjectBranches,
  useRemoteBranches,
  useRepo,
  useWorkspace,
} from "@/lib/queries";
import type { Chat } from "@reviewer/core/chats";

/** A fact about a session, in the shape of the control it stands in for. */
const PlaceChip = ({
  icon: Icon,
  label,
}: {
  icon: typeof IconGitFork;
  label: string;
}) => (
  <span className="flex max-w-48 shrink-0 items-center gap-2 px-2 py-1.5 text-sm">
    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
    <span className="truncate">{label}</span>
  </span>
);

export function SessionContextBar({ chat }: { chat?: Chat }) {
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
  const runTarget = useCloudRunTarget();
  // A choice of the cloud outlives a disconnect only as a preference: until
  // the app is connected again the session runs here, and the chip says so.
  const cloudChosen = runTarget.target === "cloud" && runTarget.connected;

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
      {chat === undefined ? (
        <>
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
            currentRepo={activeRepo(
              workspace.data ?? { repos: [], current: null }
            )}
            onFollowRepo={followRepo}
            onFetch={() => void git.fetch()}
            onPush={() => void git.push()}
          />
          <RunTargetPicker
            value={cloudChosen ? "cloud" : "local"}
            onChange={setRunTarget}
            cloudConnected={runTarget.connected}
          />
          {/* A cloud run clones the linked repository for itself, so it has
              one more question to answer: which repository that is. */}
          {cloudChosen && (
            <CloudRepoPicker
              repos={runTarget.repos}
              value={runTarget.cloudRepo}
              onChange={setCloudRepoId}
            />
          )}
        </>
      ) : (
        <>
          {chat.branch.length > 0 && (
            <PlaceChip icon={IconGitBranch} label={chat.branch} />
          )}
          {/* The repository the session's process ran in — a project may hold
              several, and a session belongs to the one it was started in. */}
          <PlaceChip icon={IconGitFork} label={chat.origin.repoName} />
        </>
      )}
    </div>
  );
}
