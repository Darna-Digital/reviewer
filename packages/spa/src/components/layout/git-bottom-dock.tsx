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
import { useEffect } from "react";
import { BranchesPanel } from "@/components/git/branches-panel";
import { BottomPanel, nativeInShell } from "@/components/layout/bottom-panel";
import { expandDock, keepDockDrawer } from "@/components/layout/dock-expansion";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter";
import { resetFindUsages } from "@/interactions/find-usages/adapters/find-usages.store";
import {
  resetHistoryFilters,
  setHistoryQuery,
  setHistoryRef,
  useHistoryFilters,
} from "@/interactions/history/history-filters.store";
import {
  useBranches,
  usePagedLog,
  useRemoteBranches,
  useRepo,
} from "@/lib/queries";
import { island } from "@/lib/shell";
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
  const git = useGitActions();

  // Held outside the dock so a file's "Show history", asked for from the page
  // below, can reach it — see `history-filters.store`.
  const { ref: logRef, query: logFilters } = useHistoryFilters();

  // A ref belongs to the repository it was read from, so opening another
  // starts the history over rather than listing a branch that repository has
  // never heard of — and takes the Find window's results with it, for the
  // same reason.
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
  const history = usePagedLog(ref, logFilters);

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

  const openCommit = (commit: CommitInfo) => {
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
          See `app-sheet-joined-start`.

          Except as a drawer inside the macOS shell, where there is no rail to
          stand against and no row of sheets to be one of: the page above runs
          to every edge of the island, and the surfaces this one used to share
          the foot of the window with are drawn natively elsewhere. So it lifts
          off the island's edges as a panel of its own — see `island-drawer`. A
          page is the whole island again, and joins its edges as before. */}
      <div
        className={cn(
          "app-sheet overflow-hidden",
          expanded || island === undefined
            ? "app-sheet-joined-start"
            : "island-drawer",
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
            />
          }
          branches={branches.data ?? []}
          currentBranch={repo.data?.currentBranch ?? null}
          commits={history.commits}
          commitsLoading={history.loading}
          commitsHaveMore={history.hasMore}
          logRef={ref}
          logFilters={logFilters}
          selectedCommitSha={params.sha ?? null}
          selectedCommitFile={search.file ?? null}
          onLoadMoreCommits={history.loadMore}
          onLogRefChange={setHistoryRef}
          onLogFiltersChange={setHistoryQuery}
          onSelectCommit={openCommit}
          onSelectCommitFile={(p) => {
            leaving();
            void navigate({ to: "/modes/code/browse", search: { file: p } });
          }}
        />
      </div>
    </>
  );
}
