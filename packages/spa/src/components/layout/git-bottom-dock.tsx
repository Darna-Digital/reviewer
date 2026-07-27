/**
 * The bottom dock for the workspace pages, mirroring the one AppShell embeds in
 * the git-review shell. It owns its queries, log ref, filters and height so it
 * drops into any shell; selections navigate into the git-review routes, and
 * `ui-prefs` keeps visibility, height and tab in step with AppShell's copy.
 *
 * It stays mounted while collapsed so Services/Threads keep their PTYs.
 */
import { useNavigate, useParams } from "@tanstack/react-router"
import { useState } from "react"
import { BottomPanel } from "@/components/layout/bottom-panel"
import { ResizeHandle } from "@/components/layout/resize-handle"
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter"
import { emptyLogQuery, type LogQuery } from "@/lib/api/types"
import { useBranches, useLog, useRemoteBranches, useRepo } from "@/lib/queries"
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs"
import { cn } from "@/lib/utils"

export function GitBottomDock() {
  const prefs = useUiPrefs()
  const navigate = useNavigate()
  const git = useGitActions()
  const params = useParams({ strict: false })

  const repo = useRepo()
  const branches = useBranches()
  const remoteBranches = useRemoteBranches()

  const [logRef, setLogRef] = useState<string | null>(null)
  const [logFilters, setLogFilters] = useState<LogQuery>(emptyLogQuery)
  const [bottomHeight, setBottomHeight] = useState(prefs.bottomHeight)

  const ref = logRef ?? repo.data?.currentBranch ?? null
  const log = useLog(ref, logFilters)

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
        className={cn(
          "shrink-0 overflow-hidden border-t",
          !prefs.bottomVisible && "hidden"
        )}
        style={{ height: bottomHeight }}
        hidden={!prefs.bottomVisible}
      >
        <BottomPanel
          tab={prefs.bottomTab}
          active={prefs.bottomVisible}
          onTabChange={(tab) => setUiPrefs({ bottomTab: tab })}
          branches={branches.data ?? []}
          remoteBranches={remoteBranches.data ?? []}
          currentBranch={repo.data?.currentBranch ?? null}
          commits={log.data ?? []}
          commitsLoading={log.isPending}
          logRef={ref}
          logFilters={logFilters}
          selectedCommitSha={params.sha ?? null}
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
