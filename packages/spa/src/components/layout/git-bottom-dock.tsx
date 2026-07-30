/**
 * The bottom dock for the workspace pages, mirroring the one AppShell embeds in
 * the git-review shell. It owns its queries, log ref, filters and height so it
 * drops into any shell; selections navigate into the git-review routes, and
 * `ui-prefs` keeps visibility, height and tab in step with AppShell's copy.
 *
 * It stays mounted while collapsed so Services/Threads keep their PTYs.
 */
import { useNavigate, useParams, useSearch } from "@tanstack/react-router"
import { useState } from "react"
import { BottomPanel } from "@/components/layout/bottom-panel"
import { ResizeHandle } from "@/components/layout/resize-handle"
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter"
import { emptyLogQuery, type LogQuery } from "@/lib/api/types"
import {
  useBranches,
  usePagedLog,
  useRemoteBranches,
  useRepo,
} from "@/lib/queries"
import {
  openBottomTab,
  setUiPrefs,
  toggleBottomVisible,
  useUiPrefs,
} from "@/lib/ui-prefs"

export function GitBottomDock() {
  const prefs = useUiPrefs()
  const navigate = useNavigate()
  const git = useGitActions()
  const params = useParams({ strict: false })
  const search = useSearch({ strict: false })

  const repo = useRepo()
  const branches = useBranches()
  const remoteBranches = useRemoteBranches()

  const [logRef, setLogRef] = useState<string | null>(null)
  const [logFilters, setLogFilters] = useState<LogQuery>(emptyLogQuery)
  const [bottomHeight, setBottomHeight] = useState(prefs.bottomHeight)

  const ref = logRef ?? repo.data?.currentBranch ?? null
  const log = usePagedLog(ref, logFilters)

  return (
    <>
      {prefs.bottomVisible && (
        <ResizeHandle
          orientation="row"
          value={bottomHeight}
          min={120}
          max={() => Math.max(160, window.innerHeight - 200)}
          direction={-1}
          onResize={setBottomHeight}
          onResizeEnd={(h) => setUiPrefs({ bottomHeight: h })}
          label="Resize bottom panel"
        />
      )}
      <div
        className="shrink-0 overflow-hidden border-t"
        style={prefs.bottomVisible ? { height: bottomHeight } : undefined}
      >
        <BottomPanel
          tab={prefs.bottomTab}
          active={prefs.bottomVisible}
          onSelectTab={openBottomTab}
          onToggle={toggleBottomVisible}
          branches={branches.data ?? []}
          remoteBranches={remoteBranches.data ?? []}
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
          onBranchCheckout={(b) => {
            void git.checkout(b)
            void navigate({ to: "/commit" })
          }}
          onSelectCommit={(c) =>
            void navigate({
              to: "/browse/commit/$sha",
              params: { sha: c.sha },
            })
          }
          onSelectCommitFile={(p) =>
            void navigate({ to: "/browse", search: { file: p } })
          }
        />
      </div>
    </>
  )
}
