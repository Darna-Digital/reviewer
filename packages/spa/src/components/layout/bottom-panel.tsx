import {
  IconGitBranch,
  IconHistory,
  IconPlayerPlay,
  IconTerminal2,
} from "@tabler/icons-react"
import { BranchTree } from "@/components/git/branch-tree"
import { CommitHistory } from "@/components/git/commit-history"
import {
  TabsSubtle,
  TabsSubtleItem,
} from "@/components/ui/tabs-subtle"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LocalDevPage } from "@/interactions/local-dev/components/local-dev-page"
import { ThreadsPage } from "@/interactions/threads/components/threads-page"
import type { LogQuery } from "@/lib/api/types"
import type { BottomTab } from "@/lib/ui-prefs"
import type {
  BranchInfo,
  CommitInfo,
  RemoteBranchInfo,
} from "@byconvo/core/repo"
import { cn } from "@/lib/utils"

const TABS: ReadonlyArray<{
  id: BottomTab
  label: string
  icon: typeof IconGitBranch
}> = [
  { id: "branches", label: "Branches", icon: IconGitBranch },
  { id: "history", label: "History", icon: IconHistory },
  { id: "services", label: "Services", icon: IconPlayerPlay },
  { id: "threads", label: "Terminal threads", icon: IconTerminal2 },
]

interface BottomPanelProps {
  tab: BottomTab
  onTabChange: (tab: BottomTab) => void
  branches: ReadonlyArray<BranchInfo>
  remoteBranches: ReadonlyArray<RemoteBranchInfo>
  currentBranch: string | null
  commits: ReadonlyArray<CommitInfo>
  commitsLoading: boolean
  logRef: string | null
  logFilters: LogQuery
  selectedCommitSha: string | null
  onLogRefChange: (ref: string) => void
  onLogFiltersChange: (filters: LogQuery) => void
  onBranchCheckout: (name: string) => void
  onSelectCommit: (commit: CommitInfo) => void
  onSelectCommitFile: (path: string) => void
}

export function BottomPanel(props: BottomPanelProps) {
  const selectedIndex = Math.max(
    0,
    TABS.findIndex((t) => t.id === props.tab)
  )

  // Picking a branch from the tree sets the history ref and jumps to History.
  const selectRef = (ref: string) => {
    props.onLogRefChange(ref)
    props.onTabChange("history")
  }

  return (
    <div className="flex h-full flex-col gap-0">
      <div className="flex h-9 shrink-0 items-center border-b px-2">
        <TabsSubtle
          idPrefix="bottom-dock"
          activeLabel
          selectedIndex={selectedIndex}
          onSelect={(index) => {
            const next = TABS[index]
            if (next) props.onTabChange(next.id)
          }}
        >
          {TABS.map((t, index) => (
            <TabsSubtleItem
              key={t.id}
              index={index}
              label={t.label}
              icon={t.icon}
            />
          ))}
        </TabsSubtle>
      </div>

      <ScrollArea
        id="bottom-dock-panel-0"
        role="tabpanel"
        aria-labelledby="bottom-dock-tab-0"
        hidden={props.tab !== "branches"}
        className={cn(
          "min-h-0 flex-1 outline-none",
          props.tab !== "branches" && "hidden"
        )}
        viewportClassName="scroll-fade"
      >
        <BranchTree
          branches={props.branches}
          remoteBranches={props.remoteBranches}
          currentBranch={props.currentBranch}
          selectedRef={props.logRef}
          onSelect={selectRef}
          onCheckout={props.onBranchCheckout}
        />
      </ScrollArea>

      <div
        id="bottom-dock-panel-1"
        role="tabpanel"
        aria-labelledby="bottom-dock-tab-1"
        hidden={props.tab !== "history"}
        className={cn(
          "min-h-0 flex-1 overflow-hidden outline-none",
          props.tab !== "history" && "hidden"
        )}
      >
        <CommitHistory
          refName={props.logRef ?? props.currentBranch ?? "HEAD"}
          branches={props.branches}
          commits={props.commits}
          query={props.logFilters}
          loading={props.commitsLoading}
          selectedCommitSha={props.selectedCommitSha}
          onRefChange={props.onLogRefChange}
          onQueryChange={props.onLogFiltersChange}
          onSelectCommit={props.onSelectCommit}
          onSelectCommitFile={props.onSelectCommitFile}
        />
      </div>

      {/* Services + Threads keep terminals mounted while inactive. */}
      <div
        id="bottom-dock-panel-2"
        role="tabpanel"
        aria-labelledby="bottom-dock-tab-2"
        hidden={props.tab !== "services"}
        className={cn(
          "min-h-0 flex-1 overflow-hidden outline-none",
          props.tab !== "services" && "hidden"
        )}
      >
        <LocalDevPage />
      </div>

      <div
        id="bottom-dock-panel-3"
        role="tabpanel"
        aria-labelledby="bottom-dock-tab-3"
        hidden={props.tab !== "threads"}
        className={cn(
          "min-h-0 flex-1 overflow-hidden outline-none",
          props.tab !== "threads" && "hidden"
        )}
      >
        <ThreadsPage />
      </div>
    </div>
  )
}
