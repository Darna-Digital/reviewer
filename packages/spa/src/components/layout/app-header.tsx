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
import { useNavigate, useRouterState, useSearch } from "@tanstack/react-router";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { HeaderDiffStyleToggle } from "@/components/layout/diff-style-toggle";
import { DockRestore } from "@/components/layout/dock-restore";
import { ComparePicker } from "@/interactions/comparison/components/compare-picker";
import { useLocalComparison } from "@/interactions/comparison/adapters/comparison.hook.adapter";
import { CollaborationSearch } from "@/interactions/collaboration/components/collaboration-search";
import { NewTaskButton } from "@/interactions/collaboration/components/task-create-dialog";
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
import { useHeaderLeadWidths } from "@/components/layout/header-lead";
import { setHeaderTabsSlot } from "@/components/layout/header-tabs";
import {
  REVIEW_HREF,
  reviewSourceOf,
  type ShellRoute,
} from "@/lib/shell-route";
import { cn } from "@/lib/utils";

/**
 * A band of the header. It is a sheet like the page under it, not a strip of
 * the frame: the branch picker, the open files and the toggles are read at a glance,
 * and through a translucent window the desktop is the one thing behind them
 * that cannot be kept out of the way.
 *
 * It sits *on* the page rather than beside it — what it names is what is
 * underneath — so it gives up its bottom edge and corners to it and the two
 * read as one surface. See `app-sheet-joined-below`.
 *
 * The inset is one number on all four sides. A 36px band around 28px chips —
 * a tab, or the branch picker at `size="chip"` — leaves 4px above and below
 * whatever the padding says, and that is also the gap between two tabs, so any
 * other figure on the sides makes the same chip look further from the edge it
 * is near than from the one it is not.
 */
const HEADER_BAND =
  "app-sheet app-sheet-joined-below flex h-9 min-w-0 items-center gap-2 px-1";

/**
 * The header, cut where the page under it is cut.
 *
 * `lead` stands over the page's outermost column, in that column's width and
 * clipped to it — the branch picker names the repository the tree beneath it is
 * of. Everything else goes in the band over the page itself, at the end. Any
 * column in between gets a band of its own with nothing in it, because what it
 * is there for is the seam beside it: the same seam the page draws, running
 * from the window bar to the dock without the header lying across it.
 *
 * A page with no columns publishes none (see `header-lead`), and there is
 * nothing to cut at: one band across, with the lead at the start of it.
 */
function HeaderRow({
  lead,
  railed,
  children,
}: {
  lead?: React.ReactNode;
  /**
   * Whether the rail stands to the left of the row. The band at the head of it
   * is then flush against the rail's rule rather than resting on the frame, so
   * it gives up its start corners to it — see `app-sheet-joined-start`.
   */
  railed?: boolean;
  children: React.ReactNode;
}) {
  const leads = useHeaderLeadWidths();
  return (
    <header className="flex shrink-0 gap-1.5">
      {leads.map((width, index) => (
        <div
          key={width}
          className={cn(
            HEADER_BAND,
            "shrink-0",
            index === 0 && railed === true && "app-sheet-joined-start"
          )}
          style={{ width }}
        >
          {index === 0 && lead}
        </div>
      ))}
      <div
        className={cn(
          HEADER_BAND,
          "flex-1",
          leads.length === 0 && railed === true && "app-sheet-joined-start"
        )}
      >
        {leads.length === 0 && lead}
        {children}
      </div>
    </header>
  );
}

export function AppHeader({ route }: { route: ShellRoute }) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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

  // The collaboration prototype drops the git chrome entirely — its own sidebar
  // carries what the branch switcher would have said.
  if (route.kind === "experimentation") {
    return (
      <HeaderRow>
        <WorkspacePicker />
        <NewTaskButton />
        <CollaborationSearch />
      </HeaderRow>
    );
  }

  const readingOwnChanges = reviewSourceOf(pathname)?.kind === "local";

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

  /**
   * What stands over the page's first column: the branch you are on, which is
   * what the tree beneath it is a tree of.
   */
  const lead = (
    <>
      {repo.data != null && (
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
      )}
    </>
  );

  /* Every page that reaches here wears the rail: the prototype is answered
     above, and the two surfaces that go without one — the blank composer and a
     conversation with the window to itself — wear no header either. See
     `AppLayout`. */
  return (
    <HeaderRow lead={lead} railed>
      {/* What the diff is read against stands over the diff, at the head of its
          band: it names what is in the pane, not what is in the tree, and over
          the tree it was cut to that column's width — a branch name shortened
          by how wide you happen to keep the file list. */}
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

      {/* Lent to the page beneath, which hangs its open-file strip here: the
          tabs choose what the pane holds, which is the same kind of control as
          the picker beside them. It stands over the pane rather than over the
          tree, because what it names is what is in the pane. */}
      <div
        ref={setHeaderTabsSlot}
        className="flex min-w-0 flex-1 items-center gap-2 empty:hidden"
      />

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {route.kind === "dock" && <DockRestore tab={route.tab} />}
        <HeaderDiffStyleToggle route={route} />
      </div>
    </HeaderRow>
  );
}
