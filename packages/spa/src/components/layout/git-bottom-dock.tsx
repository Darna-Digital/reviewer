/**
 * GitBottomDock — the self-contained git panel (Branches / History / Pull
 * requests) that docks at the bottom of the workspace pages, mirroring the one
 * AppShell embeds in the git-review shell. It owns its own queries, log ref and
 * filter state, and resize height so it can be dropped into any shell; branch,
 * commit and pull selections navigate into the git-review routes.
 *
 * Visibility and height are shared with AppShell's panel through `ui-prefs`, so
 * toggling the bottom panel is consistent across every page reachable from the
 * mode rail.
 */
import { useNavigate, useParams } from "@tanstack/react-router"
import { useState } from "react"
import { BottomPanel } from "@/components/layout/bottom-panel"
import { ResizeHandle } from "@/components/layout/resize-handle"
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter"
import { emptyLogQuery, type LogQuery } from "@/lib/api/types"
import {
  useBranches,
  useLog,
  usePulls,
  useRemoteBranches,
  useRepo,
} from "@/lib/queries"
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs"

export function GitBottomDock() {
  const prefs = useUiPrefs()
  const navigate = useNavigate()
  const git = useGitActions()
  const params = useParams({ strict: false })

  const repo = useRepo()
  const branches = useBranches()
  const remoteBranches = useRemoteBranches()
  const hasGitHub = repo.data?.github != null
  const pulls = usePulls(hasGitHub)

  const [tab, setTab] = useState<"branches" | "history" | "pulls">("branches")
  const [logRef, setLogRef] = useState<string | null>(null)
  const [logFilters, setLogFilters] = useState<LogQuery>(emptyLogQuery)
  const [bottomHeight, setBottomHeight] = useState(prefs.bottomHeight)

  const ref = logRef ?? repo.data?.currentBranch ?? null
  const log = useLog(ref, logFilters)

  if (!prefs.bottomVisible) return null

  return (
    <>
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
      <div
        className="shrink-0 overflow-hidden border-t"
        style={{ height: bottomHeight }}
      >
        <BottomPanel
          tab={tab}
          onTabChange={setTab}
          hasGitHub={hasGitHub}
          branches={branches.data ?? []}
          remoteBranches={remoteBranches.data ?? []}
          currentBranch={repo.data?.currentBranch ?? null}
          commits={log.data ?? []}
          commitsLoading={log.isPending}
          pulls={pulls.data ?? []}
          pullsError={pulls.error ? "Could not load pull requests" : null}
          logRef={ref}
          logFilters={logFilters}
          selectedCommitSha={params.sha ?? null}
          selectedPullNumber={
            params.pull !== undefined ? Number(params.pull) : null
          }
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
          onSelectPull={(p) =>
            void navigate({
              to: "/review/$pull",
              params: { pull: String(p.number) },
            })
          }
        />
      </div>
    </>
  )
}
