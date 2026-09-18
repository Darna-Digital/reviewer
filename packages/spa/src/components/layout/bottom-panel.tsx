import {
  IconArrowsDiagonal,
  IconChevronDown,
  IconGitBranch,
  IconHistory,
  IconPlayerPlay,
  IconSearch,
  IconTerminal2,
} from "@tabler/icons-react";
import { CommitHistory } from "@/components/git/commit-history";
import { PaneHeader } from "@/components/layout/pane-header";
import { Button } from "@/components/ui/button";
import { TabsSubtle, TabsSubtleItem } from "@/components/ui/tabs-subtle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FindUsagesPanel } from "@/interactions/find-usages/components/find-usages-panel";
import { LocalDevPage } from "@/interactions/local-dev/components/local-dev-page";
import { ThreadsPage } from "@/interactions/threads/components/threads-page";
import type { LogQuery } from "@/lib/api/types";
import { dockPage } from "@/lib/shell-route";
import type { BottomTab } from "@/lib/ui-prefs";
import type { BranchInfo, CommitInfo } from "@reviewer/core/repo";
import type { RepoEntry } from "@reviewer/core/workspace";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

const ICONS: Record<BottomTab, typeof IconHistory> = {
  branches: IconGitBranch,
  history: IconHistory,
  find: IconSearch,
  services: IconPlayerPlay,
  threads: IconTerminal2,
};

/**
 * The strip's own names, which are shorter than the pages': a tab is read
 * alongside its neighbours and against the surface it is sitting on, so it only
 * has to say which of them it is.
 */
const TABS: ReadonlyArray<{
  id: BottomTab;
  label: string;
  icon: typeof IconHistory;
}> = [
  { id: "branches", label: "Branches", icon: ICONS.branches },
  { id: "history", label: "History", icon: ICONS.history },
  { id: "find", label: "Find", icon: ICONS.find },
  { id: "services", label: "Services", icon: ICONS.services },
  { id: "threads", label: "Terminal sessions", icon: ICONS.threads },
];

interface BottomPanelProps {
  tab: BottomTab;
  /** Whether the dock is open. While collapsed, no new panel mounts. */
  active: boolean;
  /**
   * Whether the surface has the window to itself. A page is not a taller
   * drawer: the strip of tabs is the drawer's own way of holding four surfaces
   * in one seam, and on a page there is one surface and nowhere for it to be —
   * so the page wears the trail every other page in code mode wears instead.
   */
  expanded: boolean;
  onTabChange: (tab: BottomTab) => void;
  onCollapse: () => void;
  /** Give this surface the window. */
  onExpand: () => void;
  /** The branch manager, wired to the dock's repository actions. */
  branchPanel: React.ReactNode;
  branches: ReadonlyArray<BranchInfo>;
  currentBranch: string | null;
  commits: ReadonlyArray<CommitInfo>;
  /** Which root each commit came from, for a project of several. */
  commitRepos?: ReadonlyMap<string, RepoEntry>;
  /** The project's roots and the one the history is narrowed to, if any. */
  repos?: ReadonlyArray<RepoEntry>;
  repoFilter?: string | null;
  /** The project's own name, for the "all repositories" avatar. */
  projectName?: string;
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
  onSelectCommit: (commit: CommitInfo) => void;
  onSelectCommitFile: (path: string) => void;
}

/**
 * What makes a surface's box one of the strip's panels. On a page there is no
 * strip, so it is nothing of the sort — a tabpanel named after a tab that is not
 * on screen is a promise to the screen reader the page cannot keep.
 */
const paneProps = (index: number, expanded: boolean): ComponentProps<"div"> =>
  expanded
    ? {}
    : {
        id: `bottom-dock-panel-${index}`,
        role: "tabpanel",
        "aria-labelledby": `bottom-dock-tab-${index}`,
      };

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

  return (
    <div className="flex h-full flex-col gap-0">
      {/* The dock's chrome band, and the measure every row under it repeats:
          36px tall, a 4px margin all round its 28px controls, and 6px between
          neighbours. The tab strip and whichever surface's toolbar sits below
          it are then the same band twice over, so the rhythm at the foot of the
          window does not change when the tab does. */}
      {props.expanded ? (
        <PageTrail tab={props.tab} />
      ) : (
        <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-hairline px-1">
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
          <div className="ml-auto flex items-center gap-0.5">
            <PanelButton
              label="Expand to full page"
              icon={IconArrowsDiagonal}
              onClick={props.onExpand}
            />
            <PanelButton
              label="Collapse panel"
              icon={IconChevronDown}
              onClick={props.onCollapse}
            />
          </div>
        </div>
      )}

      <div
        {...paneProps(0, props.expanded)}
        hidden={props.tab !== "branches"}
        className={cn(
          "min-h-0 flex-1 overflow-hidden outline-none",
          props.tab !== "branches" && "hidden"
        )}
      >
        {props.active && props.tab === "branches" && props.branchPanel}
      </div>

      <div
        {...paneProps(1, props.expanded)}
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
            projectName={props.projectName}
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
        {...paneProps(2, props.expanded)}
        hidden={props.tab !== "find"}
        className={cn(
          "min-h-0 flex-1 overflow-hidden outline-none",
          props.tab !== "find" && "hidden"
        )}
      >
        {props.active && props.tab === "find" && <FindUsagesPanel />}
      </div>

      <div
        {...paneProps(3, props.expanded)}
        hidden={props.tab !== "services"}
        className={cn(
          "min-h-0 flex-1 overflow-hidden outline-none",
          props.tab !== "services" && "hidden"
        )}
      >
        {visitedTabs.has("services") && <LocalDevPage />}
      </div>

      <div
        {...paneProps(4, props.expanded)}
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

/**
 * The page's own trail, along its foot, where code mode keeps every other one:
 * which of the four surfaces this is, and nothing else. The way back into the
 * drawer is in the header — see `DockRestore`.
 */
function PageTrail({ tab }: { readonly tab: BottomTab }) {
  const Icon = ICONS[tab];

  return (
    <PaneHeader
      foot
      crumbs={[
        <span key="surface" className="flex items-center gap-1.5 font-medium">
          <Icon className="size-3.5 text-muted-foreground" />
          {dockPage(tab).title}
        </span>,
      ]}
    />
  );
}

/** The quiet icon buttons the dock's own edges carry, labelled by tooltip. */
function PanelButton({
  label,
  icon: Icon,
  onClick,
}: {
  readonly label: string;
  readonly icon: typeof IconHistory;
  readonly onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost-muted"
            size="icon-sm"
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        <Icon className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="top" align="end">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
