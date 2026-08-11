/**
 * The composer's second level — the strip tucked under it naming what the
 * session will act on: which project, and which branch of it. It reuses the
 * toolbar's own pickers rather than restating them, so switching from here is
 * the same switch, with the same menus, made where the question is asked.
 *
 * It wires itself from the repo queries instead of taking a dozen props, since
 * the pickers each want their whole git surface and the composer has no reason
 * to carry it.
 */
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { ProjectPicker } from "@/interactions/workspace/components/project-picker";
import { activeRepo } from "@byconvo/core/workspace";
import { useWorkspaceActions } from "@/interactions/workspace/adapters/workspace.hook.adapter";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter";
import {
  useBranches,
  useProjectBranches,
  useRemoteBranches,
  useRepo,
  useWorkspace,
} from "@/lib/queries";
import { repoAvatar } from "@/lib/repo-avatar";

/**
 * The project once it is settled. A started session belongs to the project it
 * was started in, so rather than a picker greyed out — a control that looks
 * broken and still invites the click — the name simply stops being one: the
 * avatar and the name stay, the chevron and the hover go, and the reason is a
 * tooltip away.
 */
function LockedProject({ name }: { name: string }) {
  const avatar = repoAvatar(name);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="flex max-w-56 cursor-default items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground" />
        }
      >
        <span
          className="flex size-4 shrink-0 items-center justify-center rounded-sm text-[9px] font-semibold text-white"
          style={{ backgroundColor: avatar.color }}
        >
          {avatar.initials}
        </span>
        <span className="truncate">{name}</span>
      </TooltipTrigger>
      <TooltipContent side="top">
        This session runs in {name}. Start a new one to work in another project.
      </TooltipContent>
    </Tooltip>
  );
}

export function SessionContextBar({
  projectLocked = false,
}: {
  /** Set once the session exists — its project can no longer be swapped. */
  projectLocked?: boolean;
}) {
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
  const [pickerOpen, setPickerOpen] = useState(false);

  const current = repo.data ?? null;

  return (
    <div className="-mt-3 flex items-center gap-1 rounded-b-lg border border-t-0 bg-elevate px-2 pt-4 pb-1.5">
      {projectLocked && current !== null ? (
        <LockedProject name={current.name} />
      ) : (
        <ProjectPicker
          workspace={workspace.data}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onChosen={() => {}}
        />
      )}
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
        onPull={() => void git.pull()}
        onPush={() => void git.push()}
      />
    </div>
  );
}
