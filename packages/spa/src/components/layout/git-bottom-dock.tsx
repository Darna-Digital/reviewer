/**
 * The bottom dock for the workspace pages, mirroring the one AppShell embeds in
 * the git-review shell. It owns its queries, log ref, filters and height so it
 * drops into any shell; selections navigate into the git-review routes, and
 * `ui-prefs` keeps visibility, height and tab in step with AppShell's copy.
 *
 * It stays mounted while collapsed so Services/Threads keep their PTYs.
 */
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { BottomPanel } from "@/components/layout/bottom-panel";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { emptyLogQuery, type LogQuery } from "@/lib/api/types";
import { useBranches, usePagedLog, useRepo } from "@/lib/queries";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

export function GitBottomDock() {
  const prefs = useUiPrefs();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });

  const repo = useRepo();
  const branches = useBranches();

  const [logRef, setLogRef] = useState<string | null>(null);
  const [logFilters, setLogFilters] = useState<LogQuery>(emptyLogQuery);
  // Not React state: the dock holds the history list and the terminals, and a
  // drag re-rendering them per pointer frame is the jank. See `usePanelSize`.
  const dock = usePanelSize("bottom-h", prefs.bottomHeight, "height");

  const ref = logRef ?? repo.data?.currentBranch ?? null;
  const log = usePagedLog(ref, logFilters);

  return (
    <>
      {prefs.bottomVisible && (
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
          "shrink-0 overflow-hidden border-t",
          !prefs.bottomVisible && "hidden"
        )}
        style={dock.style}
        hidden={!prefs.bottomVisible}
      >
        <BottomPanel
          tab={prefs.bottomTab}
          active={prefs.bottomVisible}
          onTabChange={(tab) => setUiPrefs({ bottomTab: tab })}
          onCollapse={() => setUiPrefs({ bottomVisible: false })}
          branches={branches.data ?? []}
          currentBranch={repo.data?.currentBranch ?? null}
          commits={log.commits}
          commitsLoading={log.loading}
          commitsHaveMore={log.hasMore}
          logRef={ref}
          logFilters={logFilters}
          selectedCommitSha={params.sha ?? null}
          selectedCommitFile={search.file ?? null}
          onLoadMoreCommits={log.loadMore}
          onLogRefChange={setLogRef}
          onLogFiltersChange={setLogFilters}
          onSelectCommit={(c) =>
            void navigate({
              to: "/modes/code/browse/commit/$sha",
              params: { sha: c.sha },
            })
          }
          onSelectCommitFile={(p) =>
            void navigate({ to: "/modes/code/browse", search: { file: p } })
          }
        />
      </div>
    </>
  );
}
