/**
 * The one header, for every page.
 *
 * There used to be two: the code shell's `TopBar`, taking twenty-odd props
 * drilled down from the shell that owned them, and the workspace shell's own
 * `<header>` rendering nearly the same controls from its own queries. Between
 * them they covered the same states — a project, a session, the collaboration
 * prototype — and neither could be used by the other.
 *
 * This one reads what it shows: the route says which state it is in, and the
 * queries and preferences say what to put in it. Nothing above it has to hold
 * anything on its behalf, which is what lets it sit in the layout and stay
 * mounted while the page beneath it changes.
 */
import {
  useNavigate,
  useParams,
  useRouterState,
  useSearch,
} from "@tanstack/react-router";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { DiffStyleToggle } from "@/components/layout/diff-style-toggle";
import { DockRestore } from "@/components/layout/dock-restore";
import { ComparePicker } from "@/interactions/comparison/components/compare-picker";
import { useLocalComparison } from "@/interactions/comparison/adapters/comparison.hook.adapter";
import { CollaborationSearch } from "@/interactions/collaboration/components/collaboration-search";
import { NewTaskButton } from "@/interactions/collaboration/components/task-create-dialog";
import { SessionCrumbs } from "@/interactions/chats/components/session-crumbs";
import { WorkspacePicker } from "@/interactions/collaboration/components/workspace-picker";
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter";
import { useWorkspaceActions } from "@/interactions/workspace/adapters/workspace.hook.adapter";
import { activeRepo } from "@reviewer/core/workspace";
import {
  useBranches,
  useProjectBranches,
  useRemoteBranches,
  useRepo,
  useWorkspace,
} from "@/lib/queries";
import { setHeaderTrailSlot } from "@/components/layout/header-trail";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import {
  REVIEW_HREF,
  reviewSourceOf,
  type ShellRoute,
} from "@/lib/shell-route";
import { cn } from "@/lib/utils";

export function AppHeader({ route }: { route: ShellRoute }) {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const prefs = useUiPrefs();

  const repo = useRepo();
  const workspace = useWorkspace();
  const branches = useBranches();
  const remoteBranches = useRemoteBranches();
  const projectBranchList = useProjectBranches();
  const workspaceActions = useWorkspaceActions();
  const git = useGitActions();
  const comparing = useLocalComparison();

  /** Make a root current before a menu action runs in it. */
  const followRepo = (repoPath: string) =>
    workspaceActions.followRepo(repoPath, workspace.data?.current ?? null);

  // A session is one conversation, held by its own tab: the branch switcher is
  // how you move around a repository, which is not what this surface is for.
  // Minting a session and finding one act on the list rather than on the
  // conversation, and are in the rail with the rest of what moves you about —
  // so this only names the conversation.
  if (route.kind === "session") {
    return (
      <header className="flex h-9 shrink-0 items-center gap-2 px-2">
        <SessionCrumbs />
      </header>
    );
  }

  // The collaboration prototype drops the git chrome entirely — its own sidebar
  // carries what the branch switcher would have said.
  if (route.kind === "experimentation") {
    return (
      <header className="flex h-9 shrink-0 items-center gap-2 px-2">
        <WorkspacePicker />
        <NewTaskButton />
        <CollaborationSearch />
      </header>
    );
  }

  const readingOwnChanges = reviewSourceOf(pathname)?.kind === "local";

  /**
   * The diff-style toggle belongs to a diff, so it shows when one is on screen:
   * a code page, with no file open over it, pointed at something to diff.
   */
  const showDiffStyleToggle =
    route.kind === "code" &&
    search.file === undefined &&
    (route.mode === "review" ||
      (route.mode === "browse" &&
        (params.sha !== undefined ||
          (search.base !== undefined && search.head !== undefined))));

  /**
   * What your own changes are read against — a question only your own changes
   * have. A pull request's base is GitHub's to decide and is named on the trail
   * instead; a commit and a range say what they are in the URL that named them.
   */
  const showComparePicker =
    route.kind === "code" &&
    route.mode === "review" &&
    readingOwnChanges &&
    search.file === undefined &&
    repo.data != null;

  return (
    <header className="group/header flex h-9 shrink-0 items-center gap-2 px-2">
      {/*
       * Two equal side tracks, when something is being centred between them.
       * A middle child sits on the row's midpoint only if what flanks it is
       * the same width, and the branch picker is a good deal wider than the
       * layout toggle — so the sides share the leftover room equally and the
       * picker lands on the window's midline rather than a little right of it.
       * With nothing to centre the row is the plain strip it has always been.
       */}
      <div
        className={cn(
          "flex min-w-0 items-center gap-2",
          showComparePicker ? "flex-1" : "contents"
        )}
      >
        {/*
         * Hidden by the trail's own presence, in CSS, rather than by asking the
         * route the same question the page just answered.
         *
         * Both are branch pickers with the branch they picked written on them,
         * so a third in front of them naming a branch that may be neither is
         * the reading nobody wants — but the page portals its trail in from a
         * different component, and when the two decided this separately they
         * decided it a frame and a half apart. You saw both, briefly, on every
         * navigation. `:has` cannot be late: the picker is gone in the same
         * paint the trail arrives in, and back in the paint it leaves.
         *
         * Reading your own changes is the exception the rule was never about:
         * the trail there opens with "Review", which names no branch, so the
         * picker is the only thing on the row saying whose changes these are —
         * and the only way to go and read another branch's.
         */}
        {repo.data != null && (
          <div
            className={cn(
              "contents",
              !readingOwnChanges &&
                "group-has-[[data-trail]:not(:empty)]/header:hidden"
            )}
          >
            <BranchSwitcher
              current={repo.data.currentBranch}
              branches={branches.data ?? []}
              remoteBranches={remoteBranches.data ?? []}
              busy={false}
              onCheckout={(b) => {
                void git.checkout(b);
                void navigate({ to: REVIEW_HREF });
              }}
              onCheckoutAndUpdate={(b) => {
                void git.checkoutAndUpdate(b);
                void navigate({ to: REVIEW_HREF });
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
          </div>
        )}

        {/* Lent to the page beneath, which hangs its trail here when the trail
            is what steers the page rather than what reports on it. */}
        <div
          data-trail
          ref={setHeaderTrailSlot}
          className="flex min-w-0 flex-1 items-center gap-2 empty:hidden"
        />
      </div>

      {showComparePicker && (
        <ComparePicker
          comparison={comparing.comparison}
          branch={comparing.branch}
          aim={comparing.aim}
          branches={comparing.branches}
          remoteBranches={comparing.remoteBranches}
          onSelect={comparing.compareAgainst}
        />
      )}

      <div
        className={cn(
          "flex items-center gap-1",
          showComparePicker ? "min-w-0 flex-1 justify-end" : "ml-auto shrink-0"
        )}
      >
        {route.kind === "dock" && <DockRestore tab={route.tab} />}
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
