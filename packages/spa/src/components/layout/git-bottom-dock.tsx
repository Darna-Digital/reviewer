/**
 * The bottom dock — history, find usages, services and terminal sessions — for
 * the whole app.
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
import { BottomPanel } from "@/components/layout/bottom-panel";
import { expandDock, keepDockDrawer } from "@/components/layout/dock-expansion";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { filterCommitsByRepo } from "@byconvo/core/project";
import { folderName, isMultiRepo } from "@byconvo/core/workspace";
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
  useRepo,
  useWorkspace,
} from "@/lib/queries";
import { setUiPrefs, useUiPrefs, type BottomTab } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import type { CommitInfo } from "@byconvo/core/repo";

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
  const shown = expanded || prefs.bottomVisible;

  const repo = useRepo();
  const branches = useBranches();
  const workspace = useWorkspace();
  const workspaceActions = useWorkspaceActions();

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
      {!expanded && prefs.bottomVisible && (
        <ResizeHandle
          orientation="row"
          value={dock.current}
          min={120}
          max={() => Math.max(160, window.innerHeight - 200)}
          direction={-1}
          onResize={dock.onResize}
          onResizeEnd={(h) => setUiPrefs({ bottomHeight: h })}
          label="Resize bottom panel"
        />
      )}
      <div
        className={cn(
          "overflow-hidden",
          expanded ? "min-h-0 flex-1" : "shrink-0 border-t",
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
