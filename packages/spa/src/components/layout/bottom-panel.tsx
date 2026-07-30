import {
  IconChevronDown,
  IconChevronUp,
  IconGitBranch,
  IconHistory,
  IconPlayerPlay,
  IconSettings,
  IconTerminal2,
} from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { BranchTree } from "@/components/git/branch-tree"
import { buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CommitHistory } from "@/components/git/commit-history"
import { TabsSubtle, TabsSubtleItem } from "@/components/ui/tabs-subtle"
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
import { useRef, useState } from "react"
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
  /** Whether the dock is expanded. While collapsed, no new panel mounts. */
  active: boolean
  /** Select a tab and expand the dock onto it. */
  onSelectTab: (tab: BottomTab) => void
  /** Expand or collapse the dock, keeping the selected tab. */
  onToggle: () => void
  branches: ReadonlyArray<BranchInfo>
  remoteBranches: ReadonlyArray<RemoteBranchInfo>
  currentBranch: string | null
  commits: ReadonlyArray<CommitInfo>
  commitsLoading: boolean
  commitsHaveMore: boolean
  logRef: string | null
  logFilters: LogQuery
  selectedCommitSha: string | null
  selectedCommitFile: string | null
  onLoadMoreCommits: () => void
  onLogRefChange: (ref: string) => void
  onLogFiltersChange: (filters: LogQuery) => void
  onBranchCheckout: (name: string) => void
  onSelectCommit: (commit: CommitInfo) => void
  onSelectCommitFile: (path: string) => void
}

export function BottomPanel(props: BottomPanelProps) {
  // Collapsed, no tab is selected — the bar reads as inert until a tab is
  // picked, and picking any of them (including the last one open) expands it.
  const selectedIndex = props.active
    ? Math.max(
        0,
        TABS.findIndex((t) => t.id === props.tab)
      )
    : -1

  // Services and Threads own live terminals, so once opened they stay mounted
  // while hidden. Until first opened they cost nothing.
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<BottomTab>>(
    () => new Set(props.active ? [props.tab] : [])
  )
  if (props.active && !visitedTabs.has(props.tab)) {
    setVisitedTabs(new Set(visitedTabs).add(props.tab))
  }

  // Whether the clicked tab was the open one, read at press time: selecting a
  // tab re-renders this component mid-click, so `props` is unreliable by the
  // time the click handler runs.
  const pressedTheOpenTab = useRef(false)

  // Picking a branch from the tree sets the history ref and jumps to History.
  const selectRef = (ref: string) => {
    props.onLogRefChange(ref)
    props.onSelectTab("history")
  }

  return (
    <div className="flex h-full flex-col gap-0">
      {/* The tab strip stays put while the dock is collapsed — it is the app's
          bottom bar, so clicking the selected tab toggles the panel below it. */}
      <div
        className={cn(
          "flex h-9 shrink-0 items-center gap-2 px-2",
          props.active && "border-b"
        )}
      >
        <TabsSubtle
          idPrefix="bottom-dock"
          selectedIndex={selectedIndex}
          onSelect={(index) => {
            const next = TABS[index]
            if (next) props.onSelectTab(next.id)
          }}
        >
          {TABS.map((t, index) => (
            <TabsSubtleItem
              key={t.id}
              index={index}
              label={t.label}
              icon={t.icon}
              onPointerDown={() => {
                pressedTheOpenTab.current = props.active && t.id === props.tab
              }}
              // Base UI only fires onSelect when the value changes, so
              // re-picking the open tab lands here alone — it collapses.
              onClick={() => {
                if (pressedTheOpenTab.current) props.onToggle()
              }}
            />
          ))}
        </TabsSubtle>

        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-7 rounded-lg text-muted-foreground"
              )}
              aria-label="Settings"
              render={<Link to="/settings" />}
            >
              <IconSettings className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="top">Settings</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-7 rounded-lg text-muted-foreground"
              )}
              aria-label={props.active ? "Collapse panel" : "Expand panel"}
              render={<button type="button" onClick={props.onToggle} />}
            >
              {props.active ? (
                <IconChevronDown className="size-4" />
              ) : (
                <IconChevronUp className="size-4" />
              )}
            </TooltipTrigger>
            <TooltipContent side="top">
              {props.active ? "Collapse panel" : "Expand panel"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          !props.active && "hidden"
        )}
      >
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
          {props.active && props.tab === "branches" && (
            <BranchTree
              branches={props.branches}
              remoteBranches={props.remoteBranches}
              currentBranch={props.currentBranch}
              selectedRef={props.logRef}
              onSelect={selectRef}
              onCheckout={props.onBranchCheckout}
            />
          )}
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
          {props.active && props.tab === "history" && (
            <CommitHistory
              refName={props.logRef ?? props.currentBranch ?? "HEAD"}
              branches={props.branches}
              commits={props.commits}
              query={props.logFilters}
              loading={props.commitsLoading}
              hasMore={props.commitsHaveMore}
              selectedCommitSha={props.selectedCommitSha}
              selectedFile={props.selectedCommitFile}
              onLoadMore={props.onLoadMoreCommits}
              onRefChange={props.onLogRefChange}
              onQueryChange={props.onLogFiltersChange}
              onSelectCommit={props.onSelectCommit}
              onSelectCommitFile={props.onSelectCommitFile}
            />
          )}
        </div>

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
          {visitedTabs.has("services") && <LocalDevPage />}
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
          {visitedTabs.has("threads") && <ThreadsPage />}
        </div>
      </div>
    </div>
  )
}
