import {
  IconChevronDown,
  IconGitBranch,
  IconHistory,
  IconPlayerPlay,
  IconTerminal2,
} from "@tabler/icons-react";
import { BranchTree } from "@/components/git/branch-tree";
import { ProjectBranchTree } from "@/interactions/workspace/components/project-branch-tree";
import { CommitHistory } from "@/components/git/commit-history";
import { Button } from "@/components/ui/button";
import { TabsSubtle, TabsSubtleItem } from "@/components/ui/tabs-subtle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LocalDevPage } from "@/interactions/local-dev/components/local-dev-page";
import { ThreadsPage } from "@/interactions/threads/components/threads-page";
import type { LogQuery } from "@/lib/api/types";
import type { BottomTab } from "@/lib/ui-prefs";
import type {
  BranchInfo,
  CommitInfo,
  RemoteBranchInfo,
} from "@byconvo/core/repo";
import type { RepoEntry } from "@byconvo/core/workspace";
import type { RepoBranches } from "@byconvo/core/project";
import { useState } from "react";
import { cn } from "@/lib/utils";

const TABS: ReadonlyArray<{
  id: BottomTab;
  label: string;
  icon: typeof IconGitBranch;
}> = [
  { id: "branches", label: "Branches", icon: IconGitBranch },
  { id: "history", label: "History", icon: IconHistory },
  { id: "services", label: "Services", icon: IconPlayerPlay },
  { id: "threads", label: "Terminal threads", icon: IconTerminal2 },
];

interface BottomPanelProps {
  tab: BottomTab;
  /** Whether the dock is expanded. While collapsed, no new panel mounts. */
  active: boolean;
  onTabChange: (tab: BottomTab) => void;
  onCollapse: () => void;
  branches: ReadonlyArray<BranchInfo>;
  remoteBranches: ReadonlyArray<RemoteBranchInfo>;
  currentBranch: string | null;
  commits: ReadonlyArray<CommitInfo>;
  /** Which root each commit came from, for a project of several. */
  commitRepos?: ReadonlyMap<string, RepoEntry>;
  /** The project's roots and the one the history is narrowed to, if any. */
  repos?: ReadonlyArray<RepoEntry>;
  /** Each root's branches, when the project holds several — nests the panel. */
  projectBranches?: ReadonlyArray<RepoBranches>;
  /** The root the git views follow, so its section opens first. */
  currentRepo?: string | null;
  /** Check out `ref` in `repoPath`, following that root first if need be. */
  onRepoBranchCheckout?: (repoPath: string, ref: string) => void;
  repoFilter?: string | null;
  onRepoFilterChange?: (repoPath: string | null) => void;
  commitsLoading: boolean;
  commitsHaveMore: boolean;
  logRef: string | null;
  logFilters: LogQuery;
  selectedCommitSha: string | null;
  selectedCommitFile: string | null;
  onLoadMoreCommits: () => void;
  onLogRefChange: (ref: string) => void;
  onLogFiltersChange: (filters: LogQuery) => void;
  onBranchCheckout: (name: string) => void;
  onSelectCommit: (commit: CommitInfo) => void;
  onSelectCommitFile: (path: string) => void;
}

export function BottomPanel(props: BottomPanelProps) {
  const selectedIndex = Math.max(
    0,
    TABS.findIndex((t) => t.id === props.tab)
  );

  // Services and Threads own live terminals, so once opened they stay mounted
  // while hidden. Until first opened they cost nothing.
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<BottomTab>>(
    () => new Set(props.active ? [props.tab] : [])
  );
  if (props.active && !visitedTabs.has(props.tab)) {
    setVisitedTabs(new Set(visitedTabs).add(props.tab));
  }

  // Picking a branch from the tree sets the history ref and jumps to History.
  const selectRef = (ref: string) => {
    props.onLogRefChange(ref);
    props.onTabChange("history");
  };

  return (
    <div className="flex h-full flex-col gap-0">
      <div className="flex h-9 shrink-0 items-center border-b px-2">
        <TabsSubtle
          idPrefix="bottom-dock"
          className="min-w-0"
          selectedIndex={selectedIndex}
          onSelect={(index) => {
            const next = TABS[index];
            if (next) props.onTabChange(next.id);
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
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost-muted"
                size="icon-sm"
                className="ml-auto"
                aria-label="Collapse panel"
                onClick={props.onCollapse}
              />
            }
          >
            <IconChevronDown className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="top" align="end">
            Collapse panel
          </TooltipContent>
        </Tooltip>
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
        {props.active &&
          props.tab === "branches" &&
          (props.projectBranches !== undefined ? (
            <ProjectBranchTree
              repos={props.projectBranches}
              currentRepo={props.currentRepo ?? null}
              selectedRef={props.logRef}
              onSelect={(_repoPath, ref) => selectRef(ref)}
              onCheckout={props.onRepoBranchCheckout ?? (() => {})}
            />
          ) : (
            <BranchTree
              branches={props.branches}
              remoteBranches={props.remoteBranches}
              currentBranch={props.currentBranch}
              selectedRef={props.logRef}
              onSelect={selectRef}
              onCheckout={props.onBranchCheckout}
            />
          ))}
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
            commitRepos={props.commitRepos}
            repos={props.repos}
            repoFilter={props.repoFilter}
            onRepoFilterChange={props.onRepoFilterChange}
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
  );
}
