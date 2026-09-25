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
import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePrerenderFile } from "@/components/editor/prerender";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { Button } from "@/components/ui/button";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { Orb } from "@/components/ui/orb";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { pathName } from "@/lib/display-path";
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

/**
 * How many of the results' files are read and highlighted ahead of time. The
 * list runs to a thousand usages across as many files; the first few dozen are
 * the ones stepping down it reaches before the pointer can say what is next.
 */
const IDLE_PRERENDERED_FILES = 24;

export function FindUsagesPanel({
  titledAbove = false,
}: {
  /** Whether the strip over the panel already names the search. */
  readonly titledAbove?: boolean;
}) {
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

  // The files the results sit in, read and highlighted while the window is
  // idle — as the open tabs are — so stepping onto the next file's usage
  // paints the preview coloured instead of behind a loader, and opening one
  // lands on a file that is already rendered. The rows add the one under the
  // pointer, wherever it is in the list.
  const prerenderFile = usePrerenderFile();
  const resultPaths = useMemo(
    () =>
      [
        ...new Set(fns.usages().map((usage) => usage.reference.location.path)),
      ].slice(0, IDLE_PRERENDERED_FILES),
    [fns]
  );
  useEffect(() => {
    if (resultPaths.length === 0) return;
    const warm = () => {
      for (const path of resultPaths) prerenderFile(path);
    };
    const idle = window.requestIdleCallback(warm, { timeout: 2_000 });
    return () => window.cancelIdleCallback(idle);
  }, [resultPaths, prerenderFile]);
  const prerenderRow = (node: UsageNode) => {
    const path = fns.previewed(node.id)?.reference.location.path;
    if (path !== undefined) prerenderFile(path);
  };

  const results = usages.length;
  const symbol = query?.symbol ?? "";

  // The cursor walks every row, branches included; the preview follows whatever
  // usage the row it is on stands for.
  const previewed = fns.previewed(selected);
  const selectedLocation = previewed?.reference.location ?? null;

  // Stable: the preview's IDE layer hangs its token handlers off this, and a
  // fresh function each render would rebuild the view's options every time.
  const open = useCallback(
    (location: Location) =>
      openInEditor(location.path, location.range.start.line + 1),
    [openInEditor]
  );

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

  // Sized on its own element: nothing outside the column is laid out by its
  // width, so the drag's style recalc need not reach past it.
  const resultsColumn = useRef<HTMLDivElement>(null);
  const resultsPane = usePanelSize(
    "find-results",
    prefs.findResultsWidth,
    "width",
    resultsColumn
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
        ref={resultsColumn}
        className="flex min-w-0 shrink-0 flex-col border-r"
        style={resultsPane.style}
      >
        {!titledAbove && <ResultsHeader symbol={symbol} results={results} />}
        {query === null ? (
          <Empty
            title="No search yet"
            detail="Right-click a symbol in a file and choose Find usages."
          />
        ) : search.isPending ? (
          <div className="p-4">
            <Orb size={16} label={`Searching for ${symbol}…`} />
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
            onIntent={prerenderRow}
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
        <PreviewHeader
          location={selectedLocation}
          onOpen={open}
          onIntent={prerenderFile}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          <UsagePreview
            location={selectedLocation}
            theme={prefs.resolvedTheme}
            onOpenLocation={open}
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
 * What was searched for, named in the drawer's own strip when the strip has
 * nothing else to hold — inside the shell, where Find is the drawer's only
 * surface. The glyph is centred in a column as wide as the rail under it, so
 * it stands in line with the rail's icons.
 */
export function FindUsagesTitle() {
  const { query, collapsed } = useFindUsagesState();
  const search = useUsages(query);
  const results = useMemo(
    () =>
      createFindUsagesFunctions({
        data: {
          references: search.data?.references ?? [],
          collapsed,
          declarationKind: search.data?.declaration?.kind ?? "",
        },
      }).usages().length,
    [search.data, collapsed]
  );

  return (
    <div className="flex min-w-0 items-center text-xs">
      <span className="flex w-9 shrink-0 justify-center text-muted-foreground">
        <IconSearch className="size-4" />
      </span>
      <UsageSummary symbol={query?.symbol ?? ""} results={results} />
    </div>
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
    // The glyph sits in the tree's chevron column and the symbol where a
    // top-level row's label starts, so the bar reads as the first line of the
    // list rather than as something indented past it.
    <div className="flex h-9 shrink-0 items-center gap-1.5 border-b pr-2 pl-1 text-xs">
      <IconSearch className="size-3.5 shrink-0 text-muted-foreground" />
      <UsageSummary symbol={symbol} results={results} />
    </div>
  );
}

function UsageSummary({
  symbol,
  results,
}: {
  readonly symbol: string;
  readonly results: number;
}) {
  return (
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
  );
}

/**
 * The preview's own crumb: which file is on the right, and at which line.
 *
 * It is also the way out of the search. The pane is for reading around a
 * result; when the reading is done the next thing wanted is the file itself,
 * and the name of it — sitting right there over the code — is what a hand
 * reaches for. Opening it lands on the same line the preview is showing.
 */
/**
 * The previewed file, named as the header names the file a diff is scrolled
 * to (see `HeaderDiffFileInView`): the same pill, the same hover, the folders
 * giving way first and the name keeping its room.
 */
function PreviewHeader({
  location,
  onOpen,
  onIntent,
}: {
  readonly location: Location | null;
  readonly onOpen: (location: Location) => void;
  readonly onIntent: (path: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center border-b px-1 text-xs",
        location === null && "px-2 text-muted-foreground"
      )}
    >
      {location === null ? (
        "Preview"
      ) : (
        <PreviewFileLink
          location={location}
          onOpen={onOpen}
          onIntent={onIntent}
        />
      )}
    </div>
  );
}

function PreviewFileLink({
  location,
  onOpen,
  onIntent,
}: {
  readonly location: Location;
  readonly onOpen: (location: Location) => void;
  readonly onIntent: (path: string) => void;
}) {
  const { path } = location;
  const name = pathName(path);
  const folders = path.slice(0, path.length - name.length);
  const line = location.range.start.line + 1;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => onOpen(location)}
            onPointerEnter={() => onIntent(path)}
          />
        }
        className="flex h-7 min-w-0 cursor-default items-center overflow-hidden rounded-md px-1.5 outline-none select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <FileTypeIcon path={path} className="mr-1.5 size-3.5" />
        <span className="min-w-0 truncate text-muted-foreground">
          {folders}
        </span>
        <span className="shrink-0 text-foreground">
          {name}:{line}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="max-w-none whitespace-nowrap"
      >
        {path}:{line}
      </TooltipContent>
    </Tooltip>
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
