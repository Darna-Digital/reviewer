/**
 * The Find tool window: what a symbol's usages look like when they are given a
 * surface instead of a popover.
 *
 * Three columns, the way every IDE draws this. A rail of actions on the left,
 * because they act on the whole search rather than on any one row and belong
 * where they can be reached without losing the row you are on. The results tree
 * in the middle. The file the selected result sits in on the right, so stepping
 * down the list reads the code as it goes and opening a file is a decision
 * rather than the only way to see anything.
 *
 * The window keeps nothing of its own: the search, the folds and the selection
 * all live in the store, so the drawer can show the terminal for a while and
 * come back to the tree exactly as it was left. See `find-usages.store`.
 */
import {
  IconArrowNarrowDown,
  IconArrowNarrowUp,
  IconExternalLink,
  IconFoldDown,
  IconFoldUp,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useEffect, useMemo } from "react";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { Button } from "@/components/ui/button";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOpenInEditor } from "@/lib/open-in-editor";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import type { Location } from "@reviewer/core/language";
import { useUsages } from "../adapters/find-usages.hook.adapter";
import {
  rerunFindUsages,
  selectUsage,
  setUsageCollapsed,
  useFindUsagesState,
} from "../adapters/find-usages.store";
import {
  branchIds,
  createFindUsagesFunctions,
  revealing,
  toggleCollapsed,
} from "../functions/find-usages.functions";
import type { UsageNode } from "../interfaces/find-usages.interfaces";
import { UsagePreview } from "./usage-preview";
import { UsageTree } from "./usage-tree";

/** Below this the results column is narrower than a path, so it stops there. */
const MIN_RESULTS_WIDTH = 220;

export function FindUsagesPanel() {
  const prefs = useUiPrefs();
  const { query, collapsed, selected } = useFindUsagesState();
  const search = useUsages(query);
  const openInEditor = useOpenInEditor();

  const references = useMemo(
    () => search.data?.references ?? [],
    [search.data]
  );
  // The declaration's kind names the group its own row falls into — "Function"
  // rather than the bare "Declaration" a provider that cannot say would get.
  const declarationKind = search.data?.declaration?.kind ?? "";
  const fns = useMemo(
    () =>
      createFindUsagesFunctions({
        data: { references, collapsed, declarationKind },
      }),
    [references, collapsed, declarationKind]
  );
  const rows = fns.rows();
  const usages = fns.usages();

  // A search lands on its first result, so the preview has something in it and
  // ↑/↓ have somewhere to start. Only when nothing is selected: a rerun that
  // finds the same usages must not throw away the row being read.
  useEffect(() => {
    if (selected !== null || usages.length === 0) return;
    selectUsage(usages[0].id);
  }, [selected, usages]);

  const results = usages.length;
  const symbol = query?.symbol ?? "";

  // The cursor walks every row, branches included; the preview follows whatever
  // usage the row it is on stands for.
  const previewed = fns.previewed(selected);
  const selectedLocation = previewed?.reference.location ?? null;

  const open = (location: Location) =>
    openInEditor(location.path, location.range.start.line + 1);

  const onOpen = (node: UsageNode) => {
    selectUsage(node.id);
    const location = fns.previewed(node.id)?.reference.location;
    if (location !== undefined) open(location);
  };

  /** Step to another result, opening whatever branches were hiding it. */
  const stepTo = (step: number) => {
    const next = fns.step(selected, step);
    if (next === null) return;
    setUsageCollapsed(revealing(collapsed, fns.tree(), next.id));
    selectUsage(next.id);
  };

  const resultsPane = usePanelSize(
    "find-results",
    prefs.findResultsWidth,
    "width"
  );

  return (
    <div className="flex h-full min-h-0">
      <Rail
        disabled={query === null}
        onRerun={rerunFindUsages}
        onPrevious={() => stepTo(-1)}
        onNext={() => stepTo(1)}
        onExpandAll={() => setUsageCollapsed(new Set())}
        onCollapseAll={() => setUsageCollapsed(new Set(branchIds(fns.tree())))}
        onOpen={() => {
          if (selectedLocation !== null) open(selectedLocation);
        }}
        canStep={results > 0}
        canOpen={selectedLocation !== null}
      />

      <div
        className="flex min-w-0 shrink-0 flex-col border-r"
        style={resultsPane.style}
      >
        <ResultsHeader symbol={symbol} results={results} />
        {query === null ? (
          <Empty
            title="No search yet"
            detail="Right-click a symbol in a file and choose Find usages."
          />
        ) : search.isPending ? (
          <div className="p-4">
            <LoadingCursor label={`Searching for ${symbol}…`} />
          </div>
        ) : search.error ? (
          <Empty title="Could not find usages" detail={search.error.message} />
        ) : results === 0 ? (
          <Empty
            title={`No usages of ${symbol}`}
            detail="Nothing in the project refers to this symbol."
          />
        ) : (
          <UsageTree
            rows={rows}
            selected={selected}
            symbol={symbol}
            onSelect={(node) => selectUsage(node.id)}
            onToggle={(id) => setUsageCollapsed(toggleCollapsed(collapsed, id))}
            onOpen={onOpen}
          />
        )}
      </div>

      <ResizeHandle
        orientation="col"
        value={resultsPane.current}
        min={MIN_RESULTS_WIDTH}
        max={() => Math.max(MIN_RESULTS_WIDTH, window.innerWidth - 360)}
        onResize={resultsPane.onResize}
        onResizeEnd={(width) => setUiPrefs({ findResultsWidth: width })}
        label="Resize the results list"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <PreviewHeader location={selectedLocation} />
        <div className="min-h-0 flex-1 overflow-hidden">
          <UsagePreview
            location={selectedLocation}
            theme={prefs.resolvedTheme}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The actions, down the left edge.
 *
 * Icon-only and tooltipped: they are the same six in the same order every time,
 * and the column they save is the column the results list is short of.
 */
function Rail({
  disabled,
  canStep,
  canOpen,
  onRerun,
  onPrevious,
  onNext,
  onExpandAll,
  onCollapseAll,
  onOpen,
}: {
  readonly disabled: boolean;
  readonly canStep: boolean;
  readonly canOpen: boolean;
  readonly onRerun: () => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onExpandAll: () => void;
  readonly onCollapseAll: () => void;
  readonly onOpen: () => void;
}) {
  return (
    <div className="flex w-9 shrink-0 flex-col items-center gap-0.5 border-r py-1">
      <RailButton
        label="Run the search again"
        icon={IconRefresh}
        disabled={disabled}
        onClick={onRerun}
      />
      <RailButton
        label="Previous usage"
        icon={IconArrowNarrowUp}
        disabled={!canStep}
        onClick={onPrevious}
      />
      <RailButton
        label="Next usage"
        icon={IconArrowNarrowDown}
        disabled={!canStep}
        onClick={onNext}
      />
      <div className="my-1 h-px w-5 bg-border" />
      <RailButton
        label="Expand all"
        icon={IconFoldDown}
        disabled={!canStep}
        onClick={onExpandAll}
      />
      <RailButton
        label="Collapse all"
        icon={IconFoldUp}
        disabled={!canStep}
        onClick={onCollapseAll}
      />
      <RailButton
        label="Open in editor"
        icon={IconExternalLink}
        disabled={!canOpen}
        onClick={onOpen}
      />
    </div>
  );
}

function RailButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  readonly label: string;
  readonly icon: typeof IconRefresh;
  readonly disabled: boolean;
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
            disabled={disabled}
            onClick={onClick}
          />
        }
      >
        <Icon className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * What was searched for.
 *
 * One row of the 36px band, like the strip above it and the trail under the
 * page — see `window-bar`. Where the symbol is *declared* used to sit on a
 * second line here, which made this the one bar in the stack that was two rows
 * tall; it is a row of the tree instead, under a group the declaration's own
 * kind names.
 */
function ResultsHeader({
  symbol,
  results,
}: {
  readonly symbol: string;
  readonly results: number;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-1.5 border-b px-2 text-xs">
      <IconSearch className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate">
        {symbol === "" ? (
          <span className="text-muted-foreground">Find usages</span>
        ) : (
          <>
            <span className="font-mono font-medium">{symbol}</span>
            <span className="text-muted-foreground">
              {" "}
              — {results} {results === 1 ? "usage" : "usages"}
            </span>
          </>
        )}
      </span>
    </div>
  );
}

/** The preview's own crumb: which file is on the right, and at which line. */
function PreviewHeader({ location }: { readonly location: Location | null }) {
  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 border-b px-2 text-[11px]",
        location === null && "text-muted-foreground"
      )}
    >
      {location === null ? (
        "Preview"
      ) : (
        <span className="min-w-0 truncate font-mono">
          {location.path}:{location.range.start.line + 1}
        </span>
      )}
    </div>
  );
}

function Empty({
  title,
  detail,
}: {
  readonly title: string;
  readonly detail: string;
}) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center p-4 text-center">
      <div>
        <div className="text-xs font-medium">{title}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}
