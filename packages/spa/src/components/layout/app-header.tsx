/**
 * The one header, for every page.
 *
 * There used to be two: the code shell's `TopBar`, taking twenty-odd props
 * drilled down from the shell that owned them, and the workspace shell's own
 * `<header>` rendering nearly the same controls from its own queries. Between
 * them they covered the same three states — a project, a session, a
 * collaboration workspace — and neither could be used by the other.
 *
 * This one reads what it shows: the route says which state it is in, and the
 * queries and preferences say what to put in it. Nothing above it has to hold
 * anything on its behalf, which is what lets it sit in the layout and stay
 * mounted while the page beneath it changes.
 */
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { DiffStyleToggle } from "@/components/layout/diff-style-toggle";
import { AgentStrip } from "@/interactions/session-agents/components/agent-strip";
import { CollaborationSearch } from "@/interactions/collaboration/components/collaboration-search";
import { NewSessionButton } from "@/interactions/chats/components/new-session-button";
import { NewTaskButton } from "@/interactions/collaboration/components/task-create-dialog";
import { ProjectPicker } from "@/interactions/workspace/components/project-picker";
import { SearchMenu } from "@/interactions/search/components/search-menu";
import { SessionCrumbs } from "@/interactions/chats/components/session-crumbs";
import { SessionSearch } from "@/interactions/chats/components/session-search";
import { WorkspacePicker } from "@/interactions/collaboration/components/workspace-picker";
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter";
import { useWorkspaceActions } from "@/interactions/workspace/adapters/workspace.hook.adapter";
import { activeRepo } from "@byconvo/core/workspace";
import {
  useBranches,
  useProjectBranches,
  useRemoteBranches,
  useRepo,
  useWorkspace,
} from "@/lib/queries";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import type { ShellRoute } from "@/lib/shell-route";

export function AppHeader({
  route,
  pickerOpen,
  onPickerOpenChange,
}: {
  route: ShellRoute;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const prefs = useUiPrefs();

  const repo = useRepo();
  const workspace = useWorkspace();
  const branches = useBranches();
  const remoteBranches = useRemoteBranches();
  const projectBranchList = useProjectBranches();
  const workspaceActions = useWorkspaceActions();
  const git = useGitActions();

  /** Make a root current before a menu action runs in it. */
  const followRepo = (repoPath: string) =>
    workspaceActions.followRepo(repoPath, workspace.data?.current ?? null);

  // A session is one conversation, held by its own tab: the project picker and
  // the branch switcher are how you move around a repository, and neither is
  // what this surface is for.
  if (route.kind === "session") {
    return (
      <header className="flex h-9 shrink-0 items-center gap-2 px-2">
        {/* Opens with the two things that act on the list — minting one and
            finding one — then names the conversation those act beside, and
            parks the agents answering it at the far end, where they read as
            status rather than as controls. */}
        <NewSessionButton />
        <SessionSearch />
        <SessionCrumbs />
        <div className="flex-1" />
        <AgentStrip />
      </header>
    );
  }

  // Collaboration drops the git chrome entirely — its own sidebar carries what
  // the branch switcher and the picker would have said.
  if (route.kind === "collaboration") {
    return (
      <header className="flex h-9 shrink-0 items-center gap-2 px-2">
        <WorkspacePicker />
        <NewTaskButton />
        <CollaborationSearch />
      </header>
    );
  }

  /**
   * The diff-style toggle belongs to a diff, so it shows when one is on screen:
   * a code page, with no file open over it, pointed at something to diff.
   */
  const showDiffStyleToggle =
    route.kind === "code" &&
    search.file === undefined &&
    (route.mode === "commit" ||
      (route.mode === "review" && params.pull !== undefined) ||
      (route.mode === "browse" &&
        (params.sha !== undefined ||
          (search.base !== undefined && search.head !== undefined))));

  return (
    <header className="flex h-9 shrink-0 items-center gap-2 px-2">
      {/* Project chip — opens the recents + folder-browser dropdown */}
      <ProjectPicker
        workspace={workspace.data}
        open={pickerOpen}
        onOpenChange={onPickerOpenChange}
      />

      {repo.data != null && (
        <BranchSwitcher
          current={repo.data.currentBranch}
          branches={branches.data ?? []}
          remoteBranches={remoteBranches.data ?? []}
          busy={false}
          onCheckout={(b) => {
            void git.checkout(b);
            void navigate({ to: "/modes/code/commit" });
          }}
          onCheckoutAndUpdate={(b) => {
            void git.checkoutAndUpdate(b);
            void navigate({ to: "/modes/code/commit" });
          }}
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
          onFetch={() => void git.fetch()}
          onPush={() => void git.push()}
          repos={projectBranchList.data?.repos}
          currentRepo={activeRepo(
            workspace.data ?? { repos: [], current: null }
          )}
          onFollowRepo={followRepo}
        />
      )}

      <SearchMenu />

      <div className="ml-auto flex items-center gap-1">
        {showDiffStyleToggle && (
          <DiffStyleToggle
            value={prefs.diffStyle}
            onChange={(diffStyle) => setUiPrefs({ diffStyle })}
          />
        )}
      </div>
    </header>
  );
}
