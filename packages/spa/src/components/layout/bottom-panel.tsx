import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BranchTree } from "@/components/git/branch-tree"
import { CommitHistory } from "@/components/git/commit-history"
import type { LogQuery } from "@/lib/api/types"
import type {
  BranchInfo,
  CommitInfo,
  RemoteBranchInfo,
} from "@byconvo/core/repo"

type BottomTab = "branches" | "history"

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
  // Picking a branch from the tree sets the history ref and jumps to History.
  const selectRef = (ref: string) => {
    props.onLogRefChange(ref)
    props.onTabChange("history")
  }

  return (
    <Tabs
      value={props.tab}
      onValueChange={(value) => props.onTabChange(value as BottomTab)}
      className="flex h-full flex-col gap-0"
    >
      <TabsList className="h-9 w-full justify-start gap-1 rounded-none border-b bg-transparent px-2">
        <TabsTrigger value="branches" className="flex-none">
          Branches
        </TabsTrigger>
        <TabsTrigger value="history" className="flex-none">
          History
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="branches"
        className="min-h-0 flex-1 overflow-auto p-0"
      >
        <BranchTree
          branches={props.branches}
          remoteBranches={props.remoteBranches}
          currentBranch={props.currentBranch}
          selectedRef={props.logRef}
          onSelect={selectRef}
          onCheckout={props.onBranchCheckout}
        />
      </TabsContent>

      <TabsContent
        value="history"
        className="min-h-0 flex-1 overflow-hidden p-0"
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
      </TabsContent>
    </Tabs>
  )
}
