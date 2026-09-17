/**
 * The bottom dock — branches, history, find usages, services and terminal
 * sessions — for the whole app.
 *
 * There used to be two of these: this one for the workspace pages, and a second
 * copy assembled inline by the code shell, kept in step with it by hand. They
 * were the same dock, so whichever one you were not looking at was thrown away
 * on every trip between the two shells — taking the history you had scrolled
 * and the terminals you had open with it.
 *
 * It owns its queries, log ref, filters and height so it can sit in the layout
 * above every page, and selections navigate by route rather than calling back
 * into whatever is rendering it. It stays mounted while collapsed so Services
 * and Threads keep their PTYs.
 *
 * Sitting there is also what makes a surface's full-page form free. Expanded, the
 * dock is given the canvas and the page below is put away — same component, same
 * mount, so the history keeps its place and the terminals keep running across a
 * gesture that would otherwise be a page swap. See `dock-expansion`.
 */
import {
  useNavigate,
  useParams,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { BranchesPanel } from "@/components/git/branches-panel";
import { BottomPanel, nativeInShell } from "@/components/layout/bottom-panel";
import { expandDock, keepDockDrawer } from "@/components/layout/dock-expansion";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { filterCommitsByRepo } from "@reviewer/core/project";
import { activeRepo, folderName, isMultiRepo } from "@reviewer/core/workspace";
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter";
import { useWorkspaceActions } from "@/interactions/workspace/adapters/workspace.hook.adapter";
import { resetFindUsages } from "@/interactions/find-usages/adapters/find-usages.store";
import {
  resetHistoryFilters,
  setHistoryQuery,
  setHistoryRef,
  setHistoryRepo,
  useHistoryFilters,
} from "@/interactions/history/history-filters.store";
import {
  useBranches,
  usePagedLog,
  usePagedProjectLog,
  useProjectBranches,
  useRemoteBranches,
  useRepo,
  useWorkspace,
} from "@/lib/queries";
import { REVIEW_HREF } from "@/lib/shell-route";
import { setUiPrefs, useUiPrefs, type BottomTab } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import type { CommitInfo } from "@reviewer/core/repo";

/** Below this the drag reads as closing the dock rather than sizing it. */
const COLLAPSE_HEIGHT = 120;

export function GitBottomDock({
  /**
   * The surface the window has been given over to, when the location is one of
   * the dock's pages. It names the tab as well as the shape: a page says which
   * surface it is in its URL, so the preference is not consulted while one is up.
   */
  expandedTab,
}: {
  readonly expandedTab?: BottomTab;
}) {
  const prefs = useUiPrefs();
  const navigate = useNavigate();
  const router = useRouter();
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });

  const expanded = expandedTab !== undefined;
  const tab = expandedTab ?? prefs.bottomTab;
  // A preference left on a surface the shell draws itself opens nothing here:
  // the drawer has no such tab to stand on.
  const shown = expanded || (prefs.bottomVisible && !nativeInShell(tab));

  const repo = useRepo();
  const branches = useBranches();
  const remoteBranches = useRemoteBranches();
  const projectBranches = useProjectBranches();
  const workspace = useWorkspace();
  const workspaceActions = useWorkspaceActions();
  const git = useGitActions();

  // Held outside the dock so a file's "Show history", asked for from the page
  // below, can reach it — see `history-filters.store`.
  const { ref: logRef, query: logFilters, repo: logRepo } = useHistoryFilters();

  // A ref belongs to the root it was read from, so following another root
  // starts the history over rather than listing a branch that root has never
  // heard of — and takes the Find window's results with it, for the same
  // reason.
  const root = repo.data?.root ?? null;
  useEffect(() => {
    resetHistoryFilters();
    // A search is a path and a position inside one repository; in another they
    // point at a file that is not there, or at the middle of a different one.
    resetFindUsages();
  }, [root]);
  // Not React state: the dock holds the history list and the terminals, and a
  // drag re-rendering them per pointer frame is the jank. See `usePanelSize`.
  const dock = usePanelSize("bottom-h", prefs.bottomHeight, "height");

  const dockSeam = (
    <ResizeHandle
      orientation="row"
      value={dock.current}
      min={COLLAPSE_HEIGHT}
      max={() => Math.max(160, window.innerHeight - 200)}
      direction={-1}
      onResize={dock.onResize}
      onResizeEnd={(height) => {
        if (height > COLLAPSE_HEIGHT) {
          setUiPrefs({ bottomHeight: height });
          return;
        }
        // Keep the useful height the dock had before it was dragged shut, so
        // opening it again does not bring back the collapsed sliver.
        dock.onResize(prefs.bottomHeight);
        setUiPrefs({ bottomVisible: false });
      }}
      label="Resize bottom panel"
      className="resize-handle-seam"
    />
  );

  const ref = logRef ?? repo.data?.currentBranch ?? null;
  const log = usePagedLog(ref, logFilters);

  // A project of several roots shows one history covering all of them, each row
  // saying where it came from; a single-root project has nothing to say, so it
  // keeps the paged per-branch log.
  const multiRepo = isMultiRepo({ repos: workspace.data?.repos ?? [] });
  const projectLog = usePagedProjectLog(multiRepo, logFilters);
  const projectHistory = useMemo(() => {
    const entries = filterCommitsByRepo(projectLog.entries, logRepo);
    return {
      commits: entries.map((entry) => entry.commit),
      repos: new Map(entries.map((entry) => [entry.commit.sha, entry.repo])),
    };
  }, [projectLog.entries, logRepo]);

  const history = multiRepo
    ? {
        commits: projectHistory.commits,
        repos: projectHistory.repos,
        loading: projectLog.loading,
        hasMore: projectLog.hasMore,
        loadMore: projectLog.loadMore,
      }
    : {
        commits: log.commits,
        repos: undefined,
        loading: log.loading,
        hasMore: log.hasMore,
        loadMore: log.loadMore,
      };

  /**
   * Picking something out of a surface that has the window to itself is asking
   * for the page that shows it, so the surface takes the drawer's share of the
   * window on the way — the history goes on standing under the diff it was used
   * to find, which is what it does when the drawer was never left.
   */
  const leaving = () => {
    if (expanded) keepDockDrawer(tab);
  };

  /** A branch action that opens a code page leaves Branches in the drawer. */
  const leavingBranches = () => {
    if (expanded) keepDockDrawer("branches");
  };

  /**
   * Open a commit from the history. In a project of several roots the commit
   * may belong to one that is not current, so that root is followed first —
   * every git view reads from the current root, and a sha means nothing to the
   * wrong one.
   */
  const openCommit = async (commit: CommitInfo) => {
    const owner = history.repos?.get(commit.sha) ?? null;
    if (owner !== null) {
      const followed = await workspaceActions.followRepo(
        owner.path,
        workspace.data?.current ?? null
      );
      if (!followed) return;
    }
    leaving();
    void navigate({
      to: "/modes/code/browse/commit/$sha",
      params: { sha: commit.sha },
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        path: logFilters.path ?? undefined,
        file: undefined,
      }),
    });
  };

  return (
    <>
      {/* A page has no seam to drag: it is as tall as the window, and the height
          the drawer was left at is waiting for it to be put back down. */}
      {!expanded && prefs.bottomVisible && dockSeam}
      {/* Expanded, the dock stands where the page did: directly under the
          header, which carries no bottom corners of its own. Its own top ones
          would open a notch either side of that seam, so they go too.

          On the left it stands on the rail's rule in every one of those shapes,
          so it gives up its start corners to it — held off a corner that is not
          there, the lit top edge broke for a radius' worth at the join and
          started again a step to the right, with a notch of frame in the gap.
          See `app-sheet-joined-start`. */}
      <div
        className={cn(
          "app-sheet app-sheet-joined-start overflow-hidden",
          expanded ? "app-page-joined min-h-0 flex-1" : "shrink-0",
          !shown && "hidden"
        )}
        style={expanded ? undefined : dock.style}
        hidden={!shown}
      >
        <BottomPanel
          tab={tab}
          active={shown}
          expanded={expanded}
          onTabChange={(next) => setUiPrefs({ bottomTab: next })}
          onCollapse={() => setUiPrefs({ bottomVisible: false })}
          onExpand={() => expandDock(navigate, tab, router.state.location.href)}
          branchPanel={
            <BranchesPanel
              current={repo.data?.currentBranch ?? null}
              branches={branches.data ?? []}
              remoteBranches={remoteBranches.data ?? []}
              busy={false}
              onCheckout={(branch) => {
                leavingBranches();
                void git.checkout(branch);
                void navigate({ to: REVIEW_HREF });
              }}
              onCheckoutAndUpdate={(branch) => {
                leavingBranches();
                void git.checkoutAndUpdate(branch);
                void navigate({ to: REVIEW_HREF });
              }}
              onCreateBranch={(name, startPoint) =>
                void git.createBranch(name, startPoint)
              }
              onCompare={(base, head) => {
                leavingBranches();
                void navigate({
                  to: "/modes/code/browse/range",
                  search: { base, head },
                });
              }}
              onMerge={(branch) => void git.merge(branch)}
              onRebase={(onto) => void git.rebase(onto)}
              onFetch={() => void git.fetch()}
              onPush={() => void git.push()}
              onRenameBranch={(from, to) => void git.renameBranch(from, to)}
              onDeleteBranch={(name) => void git.deleteBranch(name)}
              repos={projectBranches.data?.repos}
              currentRepo={activeRepo(
                workspace.data ?? { repos: [], current: null }
              )}
              onFollowRepo={(repoPath) =>
                workspaceActions.followRepo(
                  repoPath,
                  workspace.data?.current ?? null
                )
              }
            />
          }
          branches={branches.data ?? []}
          currentBranch={repo.data?.currentBranch ?? null}
          commits={history.commits}
          commitRepos={history.repos}
          repos={multiRepo ? (workspace.data?.repos ?? []) : undefined}
          repoFilter={logRepo}
          projectName={
            workspace.data?.project == null
              ? undefined
              : folderName(workspace.data.project)
          }
          onRepoFilterChange={setHistoryRepo}
          commitsLoading={history.loading}
          commitsHaveMore={history.hasMore}
          logRef={ref}
          logFilters={logFilters}
          selectedCommitSha={params.sha ?? null}
          selectedCommitFile={search.file ?? null}
          onLoadMoreCommits={history.loadMore}
          onLogRefChange={setHistoryRef}
          onLogFiltersChange={setHistoryQuery}
          onSelectCommit={(c) => void openCommit(c)}
          onSelectCommitFile={(p) => {
            leaving();
            void navigate({ to: "/modes/code/browse", search: { file: p } });
          }}
        />
      </div>
    </>
  );
}
