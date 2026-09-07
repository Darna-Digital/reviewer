/**
 * The strip tucked under the composer, naming where the session will land, read
 * outside in: the project it belongs to, then the branch it starts from.
 *
 * A session that already exists answers the branch as a fact. The branch it is
 * on is the one it was started on, which is not necessarily the one this window
 * happens to be showing — so the chip stops being a switcher and simply says
 * so.
 *
 * It wires itself from the repo queries instead of taking a dozen props, since
 * the switcher wants its whole git surface and the composer has no reason to
 * carry it.
 */
import { useNavigate } from "@tanstack/react-router";
import { IconGitBranch } from "@tabler/icons-react";
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
import type { Chat } from "@reviewer/core/chats";

/** A fact about a session, in the shape of the control it stands in for. */
const PlaceChip = ({
  icon: Icon,
  label,
}: {
  icon: typeof IconGitBranch;
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
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  const current = repo.data ?? null;

  return (
    <div className="-mt-3 flex items-center gap-1 rounded-b-lg border border-t-0 bg-elevate px-2 pt-4 pb-1.5">
      <ProjectPicker
        workspace={workspace.data}
        open={projectPickerOpen}
        onOpenChange={setProjectPickerOpen}
        side="top"
      />
      {chat === undefined ? (
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
      ) : (
        chat.branch.length > 0 && (
          <PlaceChip icon={IconGitBranch} label={chat.branch} />
        )
      )}
    </div>
  );
}
