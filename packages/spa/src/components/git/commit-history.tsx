import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Orb } from "@/components/ui/orb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCommitGraph } from "@/interactions/commit-graph/adapters/commit-graph.hook.adapter";
import { DEFAULT_GRAPH_CONFIG } from "@/interactions/commit-graph/interfaces/commit-graph.interfaces";
import type { LogQuery } from "@/lib/api/types";
import type { BranchInfo, CommitInfo } from "@reviewer/core/repo";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { CommitDetailsPanel } from "./commit-details-panel";
import { GraphCell } from "./commit-graph";
import { LogFilters } from "./log-filters";

/** How far ahead of the list's end the next page starts loading. */
const LOAD_MORE_MARGIN = "600px";

interface CommitHistoryProps {
  refName: string;
  branches: ReadonlyArray<BranchInfo>;
  commits: ReadonlyArray<CommitInfo>;
  query: LogQuery;
  loading: boolean;
  /** Whether the log may hold commits past the ones loaded so far. */
  hasMore: boolean;
  selectedCommitSha: string | null;
  /** File open from the selected commit, highlighted in its changed-file tree. */
  selectedFile: string | null;
  onLoadMore: () => void;
  onRefChange: (ref: string) => void;
  onQueryChange: (query: LogQuery) => void;
  onSelectCommit: (commit: CommitInfo) => void;
  onSelectCommitFile: (path: string) => void;
}

const formatDate = (iso: string): string => {
  if (iso.length === 0) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function CommitHistory({
  refName,
  branches,
  commits,
  query,
  loading,
  hasMore,
  selectedCommitSha,
  selectedFile,
  onLoadMore,
  onRefChange,
  onQueryChange,
  onSelectCommit,
  onSelectCommitFile,
}: CommitHistoryProps) {
  const { layout, functions } = useCommitGraph(commits);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const [activeSha, setActiveSha] = useState<string | null>(null);
  const prefs = useUiPrefs();
  // Not React state — a drag would re-render the commit list per pointer
  // frame. See `usePanelSize`.
  const details = usePanelSize(
    "commit-details-w",
    prefs.commitDetailsWidth,
    "width"
  );

  // Nearing the end of the loaded page pulls the next one, so scrolling walks
  // back through history instead of stopping at the first page. An observer on
  // the trailing row does the watching: measuring the viewport from a scroll
  // handler instead would read `scrollHeight` on every scroll event, forcing a
  // synchronous layout of the whole list and stuttering the scroll.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLLIElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const end = endRef.current;
    const root = viewportRef.current;
    if (end === null || root === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          onLoadMoreRef.current();
      },
      { root, rootMargin: LOAD_MORE_MARGIN }
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [hasMore, commits.length]);

  const effectiveActive =
    activeSha ??
    selectedCommitSha ??
    (commits.length > 0 ? commits[0].sha : null);

  const move = (delta: number) => {
    if (commits.length === 0) return;
    const idx = commits.findIndex((c) => c.sha === effectiveActive);
    const next =
      commits[Math.max(0, Math.min(commits.length - 1, idx + delta))];
    setActiveSha(next.sha);
    rowRefs.current.get(next.sha)?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, commit: CommitInfo) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        if (commits[0]) {
          setActiveSha(commits[0].sha);
          rowRefs.current.get(commits[0].sha)?.focus();
        }
        break;
      case "End":
        event.preventDefault();
        if (commits.at(-1)) {
          setActiveSha(commits.at(-1)!.sha);
          rowRefs.current.get(commits.at(-1)!.sha)?.focus();
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onSelectCommit(commit);
        break;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <LogFilters
        refName={refName}
        branches={branches}
        query={query}
        onRefChange={onRefChange}
        onQueryChange={onQueryChange}
      />

      <div className="flex min-h-0 flex-1">
        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="scroll-fade"
          viewportRef={viewportRef}
        >
          <ul role="listbox" aria-label="Commits" aria-busy={loading}>
            {commits.map((commit, index) => {
              const row = layout.rows[index];
              const selected = selectedCommitSha === commit.sha;
              const active = effectiveActive === commit.sha;
              return (
                <li key={commit.sha} role="option" aria-selected={selected}>
                  <div
                    tabIndex={active ? 0 : -1}
                    ref={(el) => {
                      if (el) rowRefs.current.set(commit.sha, el);
                      else rowRefs.current.delete(commit.sha);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-2 text-sm outline-none",
                      // The graph cell spans the full row so its lanes meet the
                      // rows above and below; the gap between highlights is
                      // carved out of the row instead, as a transparent block
                      // border with the background clipped inside it.
                      "rounded-md border-y-2 border-transparent bg-clip-padding",
                      "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
                      selected && "bg-accent text-accent-foreground"
                    )}
                    style={{ height: DEFAULT_GRAPH_CONFIG.rowHeight }}
                    onFocus={() => setActiveSha(commit.sha)}
                    onClick={() => onSelectCommit(commit)}
                    onKeyDown={(e) => onKeyDown(e, commit)}
                  >
                    <GraphCell
                      row={row}
                      width={layout.width}
                      functions={functions}
                      config={DEFAULT_GRAPH_CONFIG}
                    />
                    {commit.refs.length > 0 && (
                      <span className="flex shrink-0 gap-1">
                        {commit.refs.slice(0, 3).map((ref) => (
                          <Badge
                            key={ref}
                            variant="secondary"
                            className="px-1 py-0 text-[10px] font-normal"
                          >
                            {ref}
                          </Badge>
                        ))}
                      </span>
                    )}
                    <span className="truncate">{commit.subject}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {commit.author}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(commit.authoredAt)}
                    </span>
                  </div>
                </li>
              );
            })}
            {commits.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">
                {loading ? (
                  <Orb size={16} label="Loading commits…" />
                ) : (
                  "No commits match the current filters."
                )}
              </li>
            )}
            {commits.length > 0 && hasMore && (
              // Scrolling this row into view is what pulls the next page, so it
              // is the wait itself — no button to press.
              <li ref={endRef} className="flex items-center p-3">
                <Orb size={16} label="Loading older commits…" />
              </li>
            )}
          </ul>
        </ScrollArea>

        {selectedCommitSha !== null && (
          <>
            <ResizeHandle
              orientation="col"
              value={details.current}
              min={220}
              max={() => Math.max(280, window.innerWidth - 360)}
              direction={-1}
              onResize={details.onResize}
              onResizeEnd={(w) => setUiPrefs({ commitDetailsWidth: w })}
              label="Resize commit details"
            />
            <div
              className="shrink-0 overflow-hidden border-l"
              style={details.style}
            >
              <CommitDetailsPanel
                sha={selectedCommitSha}
                selectedFile={selectedFile}
                onSelectFile={onSelectCommitFile}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
