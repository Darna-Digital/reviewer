/**
 * SearchDialog — one box, three lists. It opens on **commands** (⌘K), and two
 * of those commands lead deeper: **files** (also a double-tap of Shift) searches
 * paths, **text** (also ⌘⇧F) greps file contents. A breadcrumb across the top
 * says which list you are in and walks back to the commands.
 *
 * Every mode renders the same flat list of rows, so one keyboard handler drives
 * ↑/↓ + Enter everywhere, and the headings are derived from the rows rather than
 * tracked separately.
 */
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  IconChevronRight,
  IconCornerDownLeft,
  IconFile,
  IconSearch,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ELEVATION, useElevation } from "@/lib/surface-context";
import {
  MIN_QUERY_LENGTH,
  useGrepSearch,
} from "../adapters/search.hook.adapter";
import {
  crumbsFor,
  filterCommands,
  filterFiles,
  splitPath,
} from "../functions/palette.functions";
import {
  DEFAULT_GREP_OPTIONS,
  EMPTY_GREP_RESULTS,
  groupByFile,
  matchKey,
  matchRange,
} from "../functions/search.functions";
import type {
  Command,
  GrepOptions,
  SearchMode,
} from "../interfaces/search.interfaces";

interface SearchDialogProps {
  open: boolean;
  mode: SearchMode;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: SearchMode) => void;
  commands: ReadonlyArray<Command>;
  /** Every path in the repository, for the file search. */
  files: ReadonlyArray<string>;
  onOpenFile: (path: string) => void;
  onOpenLocation: (path: string, line: number) => void;
}

/** A row in the list, whatever mode built it. */
interface Row {
  readonly key: string;
  /** Heading this row sits under; a change of group starts a new heading. */
  readonly group: string;
  readonly label: React.ReactNode;
  readonly icon?: React.ComponentType<{ className?: string }>;
  /** Fixed-width prefix — the line number of a text match. */
  readonly lead?: React.ReactNode;
  readonly hint?: string;
  readonly mono?: boolean;
  readonly run: () => void;
  /** Rows that lead deeper into the dialog keep it open. */
  readonly closeOnRun: boolean;
}

const PLACEHOLDERS: Record<SearchMode, string> = {
  commands: "Type a command…",
  files: "Search files by name…",
  text: "Search in files…",
};

const INPUT_LABELS: Record<SearchMode, string> = {
  commands: "Search commands",
  files: "Search files by name",
  text: "Search file contents",
};

const TOGGLES: ReadonlyArray<{
  key: keyof GrepOptions;
  label: string;
  glyph: string;
}> = [
  { key: "caseSensitive", label: "Match case", glyph: "Aa" },
  { key: "wholeWord", label: "Match whole word", glyph: "ab" },
  { key: "regex", label: "Use regular expression", glyph: ".*" },
];

const EMPTY_QUERIES: Record<SearchMode, string> = {
  commands: "",
  files: "",
  text: "",
};

export function SearchDialog({
  open,
  mode,
  onOpenChange,
  onModeChange,
  commands,
  files,
  onOpenFile,
  onOpenLocation,
}: SearchDialogProps) {
  // One query per mode, kept while the dialog is closed: reopening a search you
  // ran a minute ago should show it, not an empty box.
  const [queries, setQueries] = useState(EMPTY_QUERIES);
  const [options, setOptions] = useState<GrepOptions>(DEFAULT_GREP_OPTIONS);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const query = queries[mode];
  const setQuery = (next: string) => {
    setQueries((current) => ({ ...current, [mode]: next }));
    setActive(0);
  };

  // Always the text query, whatever mode is on screen: the debounce inside the
  // hook must never be left holding a command-list query when text mode opens.
  const search = useGrepSearch(queries.text, options, open && mode === "text");
  const results = search.data ?? EMPTY_GREP_RESULTS;

  /** The commands the dialog itself owns — the way into its other two modes. */
  const modeCommands = useMemo<ReadonlyArray<Command>>(
    () => [
      {
        id: "search-files",
        label: "Go to File…",
        group: "Search",
        icon: IconFile,
        keywords: "open path jump navigate",
        hint: "⇧⇧",
        run: () => onModeChange("files"),
      },
      {
        id: "search-text",
        label: "Search in Files…",
        group: "Search",
        icon: IconSearch,
        keywords: "grep content text find occurrences",
        hint: "⇧⌘F",
        run: () => onModeChange("text"),
      },
    ],
    [onModeChange]
  );

  const rows = useMemo<ReadonlyArray<Row>>(() => {
    if (mode === "commands") {
      const leadsDeeper = new Set(modeCommands.map((command) => command.id));
      return filterCommands([...modeCommands, ...commands], query).map(
        (command): Row => ({
          key: `command:${command.id}`,
          group: command.group,
          label: command.label,
          icon: command.icon,
          hint: command.hint,
          run: command.run,
          closeOnRun: !leadsDeeper.has(command.id),
        })
      );
    }
    if (mode === "files") {
      return filterFiles(files, query).map((path): Row => {
        const { directory, name } = splitPath(path);
        return {
          key: `file:${path}`,
          group: "Files",
          icon: IconFile,
          mono: true,
          label: (
            <>
              <span className="text-muted-foreground">{directory}</span>
              {name}
            </>
          ),
          run: () => onOpenFile(path),
          closeOnRun: true,
        };
      });
    }
    return groupByFile(results.matches).flatMap((file) =>
      file.matches.map(
        (match): Row => ({
          key: matchKey(match),
          group: file.path,
          mono: true,
          lead: match.line,
          label: (
            <MatchText text={match.text} query={query} options={options} />
          ),
          run: () => onOpenLocation(match.path, match.line),
          closeOnRun: true,
        })
      )
    );
  }, [
    mode,
    query,
    options,
    commands,
    modeCommands,
    files,
    results.matches,
    onOpenFile,
    onOpenLocation,
  ]);

  // The command list is a menu, not a search: it starts fresh every time.
  useEffect(() => {
    if (!open) return;
    setQueries((current) => ({ ...current, commands: "" }));
    setActive(0);
  }, [open]);

  useEffect(() => setActive(0), [mode]);

  // A query carried over from last time is selected, so typing replaces it and
  // ↑/↓ or Enter picks up where it left off.
  useEffect(() => {
    if (open && query !== "") inputRef.current?.select();
    // Only on the way in: re-selecting as the user types would be unusable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  useEffect(() => {
    setActive((current) =>
      rows.length === 0 ? 0 : Math.min(current, rows.length - 1)
    );
  }, [rows.length]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const runRow = (row: Row | undefined) => {
    if (row === undefined) return;
    if (row.closeOnRun) onOpenChange(false);
    row.run();
  };

  const onInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((a) => (rows.length === 0 ? 0 : (a + 1) % rows.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((a) =>
        rows.length === 0 ? 0 : (a - 1 + rows.length) % rows.length
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      runRow(rows[active]);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(Math.max(0, rows.length - 1));
    } else if (
      event.key === "Backspace" &&
      query === "" &&
      mode !== "commands"
    ) {
      event.preventDefault();
      onModeChange("commands");
    }
  };

  const crumbs = crumbsFor(mode);
  const { level, className: surface } = useElevation(ELEVATION.dialog);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="search-dialog"
          data-surface={level}
          data-mode={mode}
          initialFocus={inputRef}
          className={cn(
            "fixed top-[12vh] left-1/2 z-50 flex max-h-[70vh] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col overflow-hidden rounded-xl text-sm text-popover-foreground duration-100 outline-none sm:max-w-2xl",
            surface,
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Search
          </DialogPrimitive.Title>

          <nav
            aria-label="Search modes"
            className="flex items-center gap-1 px-3.5 pt-2.5 text-xs text-muted-foreground"
          >
            {crumbs.map((crumb, position) => {
              const isCurrent = position === crumbs.length - 1;
              return (
                <div key={crumb.mode} className="flex items-center gap-1">
                  {position > 0 && (
                    <IconChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {isCurrent ? (
                    <span aria-current="page" className="text-foreground">
                      {crumb.label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onModeChange(crumb.mode)}
                      className="rounded-md px-1 py-0.5 outline-none hover:bg-elevate hover:text-foreground"
                    >
                      {crumb.label}
                    </button>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 border-b px-3.5">
            <IconSearch className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              aria-label={INPUT_LABELS[mode]}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder={PLACEHOLDERS[mode]}
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {mode === "text" && (
              <div className="flex shrink-0 items-center gap-0.5">
                {TOGGLES.map((toggle) => (
                  <button
                    key={toggle.key}
                    type="button"
                    aria-label={toggle.label}
                    aria-pressed={options[toggle.key]}
                    onClick={() => {
                      setOptions((current) => ({
                        ...current,
                        [toggle.key]: !current[toggle.key],
                      }));
                      setActive(0);
                    }}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-md font-mono text-[0.6875rem] outline-none",
                      options[toggle.key]
                        ? "bg-elevate-strong text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {toggle.glyph}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ScrollArea
            viewportRef={listRef}
            className="min-h-0 flex-1"
            viewportClassName="scroll-fade overflow-x-hidden p-1.5"
          >
            {rows.length === 0 ? (
              <div className="px-3 py-6 text-center text-muted-foreground">
                <EmptyState
                  mode={mode}
                  query={query}
                  loading={search.isFetching}
                  error={search.error}
                />
              </div>
            ) : (
              rows.map((row, index) => {
                const isActive = index === active;
                const startsGroup = rows[index - 1]?.group !== row.group;
                const Icon = row.icon;
                return (
                  <div key={row.key}>
                    {startsGroup && (
                      <div
                        className={cn(
                          "truncate px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground",
                          mode === "text" && "font-mono"
                        )}
                      >
                        {row.group}
                      </div>
                    )}
                    <button
                      type="button"
                      data-index={index}
                      // Hover updates selection so mouse and keyboard stay in sync.
                      onMouseMove={() => setActive(index)}
                      onClick={() => runRow(row)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left outline-none",
                        row.mono && "font-mono text-[0.8125rem]",
                        isActive && "bg-elevate-strong"
                      )}
                    >
                      {Icon !== undefined && (
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      {row.lead !== undefined && (
                        <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                          {row.lead}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {row.label}
                      </span>
                      {row.hint !== undefined && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {row.hint}
                        </span>
                      )}
                      {isActive && (
                        <IconCornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </ScrollArea>

          <div className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
            <span className="min-w-0 truncate">
              <Summary mode={mode} rows={rows} truncated={results.truncated} />
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <Kbd>↵</Kbd>
              {mode === "commands" ? "to select" : "to open"}
              <span aria-hidden="true">·</span>
              <Kbd>esc</Kbd>
              to close
            </span>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}

/** What the text search found — the other modes speak for themselves. */
function Summary({
  mode,
  rows,
  truncated,
}: {
  mode: SearchMode;
  rows: ReadonlyArray<Row>;
  truncated: boolean;
}) {
  if (mode !== "text" || rows.length === 0) return null;
  const files = new Set(rows.map((row) => row.group)).size;
  return (
    <>
      {rows.length} {rows.length === 1 ? "match" : "matches"} in {files}{" "}
      {files === 1 ? "file" : "files"}
      {truncated && " (first results only)"}
    </>
  );
}

function EmptyState({
  mode,
  query,
  loading,
  error,
}: {
  mode: SearchMode;
  query: string;
  loading: boolean;
  error: unknown;
}) {
  if (mode === "commands") return <>No commands found.</>;
  if (mode === "files") {
    return query.trim().length === 0 ? (
      <>Type to find a file by name.</>
    ) : (
      <>No files match.</>
    );
  }
  if (error !== null && error !== undefined) {
    return <>Could not search this repository.</>;
  }
  if (query.trim().length < MIN_QUERY_LENGTH) return <>Type to search.</>;
  if (loading) return <>Searching…</>;
  return <>No matches found.</>;
}

/** The matched line, with the hit itself picked out of it. */
function MatchText({
  text,
  query,
  options,
}: {
  text: string;
  query: string;
  options: GrepOptions;
}) {
  const range = matchRange(text, query, options);
  const trimmed = text.trimStart();
  if (range === null) return <>{trimmed}</>;
  const offset = text.length - trimmed.length;
  const start = Math.max(0, range.start - offset);
  const end = Math.max(start, range.end - offset);
  return (
    <>
      {trimmed.slice(0, start)}
      <mark className="rounded-sm bg-amber-400/30 text-foreground">
        {trimmed.slice(start, end)}
      </mark>
      {trimmed.slice(end)}
    </>
  );
}
