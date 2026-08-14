import type {
  DiffLineAnnotation,
  FileDiffContentsLoader,
  FileDiffLoadedFiles,
  FileDiffMetadata,
  Hunk,
  SelectedLineRange,
} from "@pierre/diffs";
import { FileDiff, Virtualizer } from "@pierre/diffs/react";
import {
  IconArrowBackUp,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconHistory,
} from "@tabler/icons-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CommentThread,
  DraftCard,
  type DraftLocation,
} from "@/interactions/comments/components/comment-thread";
import {
  DiffConnectors,
  connectorGutterCSS,
} from "@/interactions/diff/components/diff-connectors";
import { DiagnosticsAnnotation } from "@/interactions/language/components/diagnostics-annotation";
import { useDiffLanguage } from "@/interactions/language/components/use-diff-language";
import type { DiagnosticsAnnotationMeta } from "@/interactions/language/components/language-layer";
import { fetchClient } from "@/lib/api/client";
import { selectionShadingCSS } from "@/lib/code-selection-css";
import {
  useStableCallback,
  useStableOptionalCallback,
} from "@/lib/stable-callback";
import { diffTargetKey, type DiffTarget } from "@/lib/api/types";
import type { CommentSide, ReviewComment } from "@byconvo/core/comments";
import type { DiffStyle, Theme } from "@/lib/ui-prefs";

export type { DraftLocation };

type AnnotationMeta =
  | {
      readonly kind: "comments";
      readonly comments: ReadonlyArray<ReviewComment>;
    }
  // The body travels with the draft so a composer reopened after a refused
  // write comes back holding what was typed. Absent for a fresh draft.
  | { readonly kind: "draft"; readonly body?: string }
  | { readonly kind: "hunk"; readonly hunkIndex: number }
  | DiagnosticsAnnotationMeta;

interface DiffPaneProps {
  files: ReadonlyArray<FileDiffMetadata>;
  theme: Theme;
  diffStyle: DiffStyle;
  connectors: boolean;
  loading: boolean;
  error: string | null;
  target: DiffTarget;
  comments: ReadonlyArray<ReviewComment>;
  draft: DraftLocation | null;
  selectedFile: string | null;
  onDraftOpen: (draft: DraftLocation) => void;
  onDraftCancel: () => void;
  onEditFile: (path: string) => void;
  /** Open a file's commit history in the bottom dock. */
  onShowFileHistory?: (path: string) => void;
  /** Discard a file's worktree changes (revert to HEAD). Only wired in commit
   * mode, where the diff is the working tree; absent means no discard control. */
  onDiscardFile?: (path: string) => void;
  /** Discard a single hunk of a file's worktree diff. Only wired in commit mode;
   * absent means no per-hunk discard control is rendered. */
  onDiscardHunk?: (path: string, hunkIndex: number) => void;
  onCommentSubmit: (location: DraftLocation, body: string) => Promise<void>;
  onCommentDelete: (comment: ReviewComment) => Promise<void>;
  onCommentEdit: (comment: ReviewComment, body: string) => Promise<void>;
  onCommentReply: (comment: ReviewComment, body: string) => Promise<void>;
  /** Go-to-definition and find-usages land here. */
  onOpenLocation: (path: string, lineNumber: number) => void;
}

const emptyHint = (target: DiffTarget): string => {
  switch (target.kind) {
    case "worktree":
      return "Working tree is clean — make some changes and hit refresh.";
    case "range":
      return "These refs are identical.";
    case "commit":
      return "This commit has no textual changes.";
    case "pull":
      return "This pull request has no diff.";
  }
};

const THEMES = { light: "github-light", dark: "github-dark" } as const;

/**
 * The `/api/diff-file` params that pin both sides of `target`, so expanded
 * context comes from the same refs the diff was generated from. A pull is
 * served best-effort from the local clone: GitHub's PR diff is
 * merge-base(base, head) → head, which resolves once the PR's commits have
 * been fetched (and fails harmlessly — see loader below — when they haven't).
 */
const diffFileTargetQuery = (
  target: DiffTarget
): { commit?: string; base?: string; head?: string } => {
  switch (target.kind) {
    case "worktree":
      return {};
    case "commit":
      return { commit: target.sha };
    case "range":
      return { base: target.base, head: target.head };
    case "pull":
      return {
        base: `origin/${target.pull.baseRef}`,
        head: target.pull.headSha,
      };
  }
};

/**
 * Where a hunk's discard control anchors: the line just above the hunk's first
 * *changed* line (annotations render below their anchor, so this lands the
 * control directly above the change — not on the leading context, and not
 * splitting the change). Falls back to the first changed line when the change
 * opens the hunk with no leading context.
 */
const hunkChangeAnchor = (
  hunk: Hunk
): { side: CommentSide; lineNumber: number } => {
  let addition = hunk.additionStart;
  let deletion = hunk.deletionStart;
  let sawContext = false;
  for (const block of hunk.hunkContent) {
    if (block.type === "context") {
      addition += block.lines;
      deletion += block.lines;
      sawContext = true;
      continue;
    }
    return block.additions > 0
      ? { side: "additions", lineNumber: sawContext ? addition - 1 : addition }
      : { side: "deletions", lineNumber: sawContext ? deletion - 1 : deletion };
  }
  return { side: "additions", lineNumber: hunk.additionStart };
};

interface FileDiffSectionProps {
  file: FileDiffMetadata;
  theme: Theme;
  diffStyle: DiffStyle;
  connectorsEnabled: boolean;
  /** Render this file whole (all unchanged lines expanded) instead of hunks. */
  expandUnchanged: boolean;
  /** Takes the file's name, so the parent needs no per-file closure. */
  onToggleExpandUnchanged: (name: string) => void;
  loadDiffFiles: FileDiffContentsLoader;
  annotations: ReadonlyArray<DiffLineAnnotation<AnnotationMeta>>;
  selectedLines: SelectedLineRange | null;
  onDraftOpen: (draft: DraftLocation) => void;
  onDraftCancel: () => void;
  onEditFile: (path: string) => void;
  onShowFileHistory?: (path: string) => void;
  onDiscardFile?: (path: string) => void;
  onDiscardHunk?: (path: string, hunkIndex: number) => void;
  onCommentSubmit: (location: DraftLocation, body: string) => Promise<void>;
  onCommentDelete: (comment: ReviewComment) => Promise<void>;
  onCommentEdit: (comment: ReviewComment, body: string) => Promise<void>;
  onCommentReply: (comment: ReviewComment, body: string) => Promise<void>;
  /** Give this file the language layer — only true for a worktree diff. */
  languageEnabled: boolean;
  onOpenLocation: (path: string, lineNumber: number) => void;
}

/**
 * One file's diff, memoised — the pane renders one of these per changed file,
 * and each of them highlights, lays out and virtualizes a whole file.
 *
 * Without the memo every render of the pane re-rendered every file: selecting
 * a file in the tree, opening a comment draft, or a background refetch settling
 * did the work of the entire diff again, and a review of eighty files paid for
 * eighty of them to redraw so that one could. The props are all stable by
 * construction (see `DiffPane`), so what re-renders now is the file that
 * actually changed.
 */
const FileDiffSection = memo(function FileDiffSection({
  file,
  theme,
  diffStyle,
  connectorsEnabled,
  expandUnchanged,
  onToggleExpandUnchanged,
  loadDiffFiles,
  annotations,
  selectedLines,
  onDraftOpen,
  onDraftCancel,
  onEditFile,
  onShowFileHistory,
  onDiscardFile,
  onDiscardHunk,
  onCommentSubmit,
  onCommentDelete,
  onCommentEdit,
  onCommentReply,
  languageEnabled,
  onOpenLocation,
}: FileDiffSectionProps) {
  // Callback-ref state (not a ref object): DiffConnectors reads the section in a
  // layout effect, which fires bottom-up, so a child would see a parent ref as
  // null. The setter only fires on mount.
  const [sectionEl, setSectionEl] = useState<HTMLElement | null>(null);
  const recomputeConnectors = useRef<() => void>(() => {});

  // Hover documentation, go-to-definition and find-usages over the additions
  // side, which for a worktree diff is the file as it is on disk.
  const language = useDiffLanguage({
    path: file.name,
    section: sectionEl,
    enabled: languageEnabled,
    onOpenLocation,
  });

  const withDiagnostics = useMemo(
    () => [...annotations, ...language.annotations],
    [annotations, language.annotations]
  );

  return (
    <section
      ref={setSectionEl}
      className="diff-file relative border-b"
      data-file-anchor={file.name}
    >
      <FileDiff<AnnotationMeta>
        fileDiff={file}
        selectedLines={selectedLines}
        options={{
          theme: THEMES,
          themeType: theme,
          diffStyle,
          lineDiffType: "word",
          overflow: diffStyle === "split" ? "scroll" : "wrap",
          stickyHeader: false,
          // Full-file support: the loader hydrates the unchanged regions of a
          // patch-parsed diff, which both makes the hunk separators expandable
          // and lets expandUnchanged render the whole file.
          loadDiffFiles,
          expandUnchanged,
          enableGutterUtility: true,
          ...language.viewOptions,
          unsafeCSS: [
            selectionShadingCSS,
            connectorsEnabled ? connectorGutterCSS : "",
            language.viewOptions.unsafeCSS,
          ].join("\n"),
          onPostRender: (node, instance, phase) => {
            // Both need to know the code rendered: the connectors to measure
            // it, the language layer to know it may start asking about it.
            if (connectorsEnabled) recomputeConnectors.current();
            language.viewOptions.onPostRender(node, instance, phase);
          },
          onGutterUtilityClick: (range) =>
            onDraftOpen({
              filePath: file.name,
              side: range.side ?? "additions",
              lineNumber: range.end,
            }),
          onLineNumberClick: (props) =>
            onDraftOpen({
              filePath: file.name,
              side: props.annotationSide,
              lineNumber: props.lineNumber,
            }),
        }}
        renderHeaderMetadata={(meta) => (
          <div className="flex items-center gap-1">
            {/* New/deleted files already carry their whole content in the
             * patch, so there is nothing extra to expand. */}
            {meta.type !== "new" && meta.type !== "deleted" && (
              <Button
                variant="ghost-muted"
                size="xs"
                className="gap-1"
                aria-pressed={expandUnchanged}
                title={
                  expandUnchanged
                    ? `Collapse ${meta.name} to its changed lines`
                    : `Show all of ${meta.name}`
                }
                onClick={() => onToggleExpandUnchanged(file.name)}
              >
                {expandUnchanged ? (
                  <IconArrowsMinimize className="size-3.5" />
                ) : (
                  <IconArrowsMaximize className="size-3.5" />
                )}
                {expandUnchanged ? "Changes only" : "Full file"}
              </Button>
            )}
            {onDiscardFile !== undefined && (
              // Revert this file to HEAD. Available for every change type
              // (a deletion is restored, an addition removed).
              <Button
                variant="ghost-muted"
                size="xs"
                className="gap-1 hover:text-destructive hover:[&_svg]:text-destructive"
                title={`Discard changes in ${meta.name}`}
                onClick={() => {
                  if (
                    window.confirm(
                      `Discard all changes in ${meta.name}?\n\nThis reverts the file to the last commit and cannot be undone.`
                    )
                  )
                    onDiscardFile(meta.name);
                }}
              >
                <IconArrowBackUp className="size-3.5" />
                Discard
              </Button>
            )}
            {onShowFileHistory !== undefined && (
              <Button
                variant="ghost-muted"
                size="xs"
                className="gap-1"
                title={`Show the commit history of ${meta.name}`}
                onClick={() => onShowFileHistory(meta.name)}
              >
                <IconHistory className="size-3.5" />
                History
              </Button>
            )}
            {meta.type !== "deleted" && (
              <Button
                variant="ghost-muted"
                size="xs"
                onClick={() => onEditFile(meta.name)}
              >
                Edit
              </Button>
            )}
          </div>
        )}
        lineAnnotations={withDiagnostics}
        renderAnnotation={(annotation) => {
          const meta = annotation.metadata;
          if (meta.kind === "diagnostics") {
            return <DiagnosticsAnnotation diagnostics={meta.diagnostics} />;
          }
          if (meta.kind === "hunk") {
            // A quiet, icon-only revert affordance in the spirit of JetBrains'
            // gutter change markers — right-aligned, minimal vertical footprint.
            // The icon alone is ambiguous, so a tooltip spells out the action.
            return (
              // em units so the control scales with the diff's own font size.
              <div className="flex justify-end px-[0.6em] py-[0.2em]">
                <Tooltip>
                  <TooltipTrigger
                    aria-label="Discard hunk"
                    className="flex items-center justify-center rounded p-[0.3em] text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                    render={
                      <button
                        type="button"
                        onClick={() =>
                          onDiscardHunk?.(file.name, meta.hunkIndex)
                        }
                      />
                    }
                  >
                    <IconArrowBackUp className="size-[1.3em]" />
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Discard this change — revert the hunk to the last commit
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          }
          if (meta.kind === "draft") {
            return (
              <DraftCard
                onCancel={onDraftCancel}
                {...(meta.body === undefined ? {} : { initialBody: meta.body })}
                onSubmit={(body) =>
                  onCommentSubmit(
                    {
                      filePath: file.name,
                      side: annotation.side,
                      lineNumber: annotation.lineNumber,
                    },
                    body
                  )
                }
              />
            );
          }
          return (
            <CommentThread
              comments={meta.comments}
              onDelete={onCommentDelete}
              onEdit={onCommentEdit}
              onReply={onCommentReply}
            />
          );
        }}
      />
      <DiffConnectors
        section={sectionEl}
        recomputeRef={recomputeConnectors}
        enabled={connectorsEnabled}
      />
      {language.card}
    </section>
  );
});

/** A file with no comments, draft or hunk control — one array, not one each. */
const NO_ANNOTATIONS: ReadonlyArray<DiffLineAnnotation<AnnotationMeta>> = [];

export function DiffPane({
  files,
  theme,
  diffStyle,
  connectors,
  loading,
  error,
  target,
  comments,
  draft,
  selectedFile,
  onDraftOpen: rawOnDraftOpen,
  onDraftCancel: rawOnDraftCancel,
  onEditFile: rawOnEditFile,
  onShowFileHistory: rawOnShowFileHistory,
  onDiscardFile: rawOnDiscardFile,
  onDiscardHunk: rawOnDiscardHunk,
  onCommentSubmit: rawOnCommentSubmit,
  onCommentDelete: rawOnCommentDelete,
  onCommentEdit: rawOnCommentEdit,
  onCommentReply: rawOnCommentReply,
  onOpenLocation: rawOnOpenLocation,
}: DiffPaneProps) {
  // Every handler arrives from the shell as a fresh closure on each of its
  // renders, which would hand each memoised file section a changed prop and
  // undo the memo entirely. Pinned here, in one place, rather than asking the
  // shell to hand-memoise a dozen callbacks — see `useStableCallback`. The
  // optional ones keep their absence, which is what decides whether a control
  // is rendered at all.
  const onDraftOpen = useStableCallback(rawOnDraftOpen);
  const onDraftCancel = useStableCallback(rawOnDraftCancel);
  const onEditFile = useStableCallback(rawOnEditFile);
  const onOpenLocation = useStableCallback(rawOnOpenLocation);
  const onCommentSubmit = useStableCallback(rawOnCommentSubmit);
  const onCommentDelete = useStableCallback(rawOnCommentDelete);
  const onCommentEdit = useStableCallback(rawOnCommentEdit);
  const onCommentReply = useStableCallback(rawOnCommentReply);
  const onShowFileHistory = useStableOptionalCallback(rawOnShowFileHistory);
  const onDiscardFile = useStableOptionalCallback(rawOnDiscardFile);
  const onDiscardHunk = useStableOptionalCallback(rawOnDiscardHunk);

  const connectorsEnabled = connectors && diffStyle === "split";
  const containerRef = useRef<HTMLDivElement>(null);

  // Per-file "show the whole file" choices, scoped to the current target: the
  // stored key invalidates the set when the user navigates to another diff, so
  // stale expansions never leak across targets (no effect/reset dance needed).
  const targetKey = diffTargetKey(target);
  const [expansion, setExpansion] = useState<{
    key: string;
    files: ReadonlySet<string>;
  }>({ key: targetKey, files: new Set() });
  const expandedFiles =
    expansion.key === targetKey ? expansion.files : new Set<string>();
  const toggleExpanded = useCallback(
    (name: string) =>
      setExpansion((prev) => {
        const next = new Set(prev.key === targetKey ? prev.files : []);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return { key: targetKey, files: next };
      }),
    [targetKey]
  );

  // Fetch both full sides of a file so @pierre/diffs can render the unchanged
  // regions (per-hunk expansion and the "full file" view). Throwing is the
  // loader's "not available" signal — the library keeps the collapsed,
  // hunks-only rendering — so on failure we also toast (a silent no-op click
  // reads as a broken button) and flip the file back to collapsed, keeping the
  // header toggle truthful. Typical failures: a server build without
  // /api/diff-file, or a PR whose commits haven't been fetched yet.
  const loadDiffFiles = useCallback(
    async (file: FileDiffMetadata): Promise<FileDiffLoadedFiles> => {
      try {
        const { data, error: fetchError } = await fetchClient.GET(
          "/api/diff-file",
          {
            params: {
              query: {
                ...diffFileTargetQuery(target),
                path: file.name,
                ...(file.prevName != null ? { prevPath: file.prevName } : {}),
              },
            },
          }
        );
        if (fetchError !== undefined || data === undefined)
          throw new Error(`Could not load contents for ${file.name}`);
        if (data.newContents === null)
          throw new Error(`No diff contents available for ${file.name}`);
        const newFile = { name: file.name, contents: data.newContents };
        if (file.type === "rename-pure") return { oldFile: null, newFile };
        if (data.oldContents === null)
          throw new Error(`No previous contents available for ${file.name}`);
        return {
          oldFile: {
            name: file.prevName ?? file.name,
            contents: data.oldContents,
          },
          newFile,
        };
      } catch (error) {
        toast.error(`Couldn't load the rest of ${file.name}`, {
          description:
            target.kind === "pull"
              ? "The pull request's commits may not be fetched locally yet — try Fetch, then expand again."
              : "The server couldn't provide this file's full contents.",
        });
        setExpansion((prev) => {
          if (prev.key !== targetKey || !prev.files.has(file.name)) return prev;
          const files = new Set(prev.files);
          files.delete(file.name);
          return { key: targetKey, files };
        });
        throw error;
      }
    },
    [target, targetKey]
  );

  // Animate the selected file's diff to the top of the pane. Hard-won details:
  //  - Native smooth scrolling (`scrollIntoView`/`scrollTo({behavior:"smooth"})`,
  //    CSS `scroll-behavior`) is a silent no-op in this pane — the nested
  //    overflow-hidden ancestors break it in Chromium. Only instant `scrollTop`
  //    writes take effect, so we roll the animation ourselves with rAF.
  //  - Each frame eases ~20% of the remaining distance and *recomputes* the
  //    target, so the animation stays accurate while the diffs lay out
  //    progressively (the anchor keeps moving for a moment after selection).
  //  - We bail the instant the user takes over via real input (wheel/touch/
  //    pointer/key) — never on scroll events, which also fire from our own
  //    animation and from layout reflow.
  //  - rAF is throttled in background tabs, so a timed fallback jumps straight to
  //    the target if no frame has run.
  useEffect(() => {
    if (selectedFile === null) return;
    // The scrolling element is the Virtualizer's own root div (it must own the
    // scroll to window rendering), which is the wrapper's only child.
    const container = containerRef.current?.firstElementChild;
    if (!(container instanceof HTMLElement)) return;

    let active = true;
    let raf = 0;
    let lastFrame = 0;
    const startedAt = performance.now();
    const cleanups: Array<() => void> = [];

    const targetTop = (): number | null => {
      const anchor = container.querySelector(
        `[data-file-anchor="${CSS.escape(selectedFile)}"]`
      );
      if (!(anchor instanceof HTMLElement)) return null;
      const max = container.scrollHeight - container.clientHeight;
      return Math.min(
        anchor.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop,
        max
      );
    };

    const stop = () => {
      if (!active) return;
      active = false;
      cancelAnimationFrame(raf);
      for (const cleanup of cleanups) cleanup();
    };

    const frame = (now: number) => {
      if (!active) return;
      lastFrame = now;
      const top = targetTop();
      if (top !== null) {
        const delta = top - container.scrollTop;
        container.scrollTop =
          Math.abs(delta) <= 1 ? top : container.scrollTop + delta * 0.2;
      }
      // Keep following while the content settles; then stop.
      if (now - startedAt < 1200) raf = requestAnimationFrame(frame);
      else stop();
    };

    for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
      container.addEventListener(type, stop, { passive: true });
      cleanups.push(() => container.removeEventListener(type, stop));
    }

    // Background-tab fallback: if rAF hasn't run (throttled), jump to target.
    const fallback = setTimeout(() => {
      if (!active || performance.now() - lastFrame < 100) return;
      const top = targetTop();
      if (top !== null) container.scrollTop = top;
    }, 250);
    cleanups.push(() => clearTimeout(fallback));

    raf = requestAnimationFrame(frame);

    return stop;
  }, [selectedFile, files]);

  const annotationsByFile = useMemo(() => {
    const result = new Map<string, Array<DiffLineAnnotation<AnnotationMeta>>>();
    const grouped = new Map<
      string,
      {
        filePath: string;
        side: CommentSide;
        lineNumber: number;
        comments: ReviewComment[];
      }
    >();
    for (const c of comments) {
      const key = `${c.side}:${c.lineNumber}:${c.filePath}`;
      const bucket = grouped.get(key);
      if (bucket) bucket.comments.push(c);
      else
        grouped.set(key, {
          filePath: c.filePath,
          side: c.side,
          lineNumber: c.lineNumber,
          comments: [c],
        });
    }
    for (const g of grouped.values()) {
      const arr = result.get(g.filePath) ?? [];
      arr.push({
        side: g.side,
        lineNumber: g.lineNumber,
        metadata: { kind: "comments", comments: g.comments },
      });
      result.set(g.filePath, arr);
    }
    if (draft !== null) {
      const arr = result.get(draft.filePath) ?? [];
      arr.push({
        side: draft.side,
        lineNumber: draft.lineNumber,
        metadata:
          draft.body === undefined
            ? { kind: "draft" }
            : { kind: "draft", body: draft.body },
      });
      result.set(draft.filePath, arr);
    }
    // Anchor a "Discard hunk" control at the start of each hunk. Only in commit
    // mode (onDiscardHunk provided); hunk order here matches the server's
    // `git diff HEAD -- <path>`, so the index round-trips to the discard call.
    if (onDiscardHunk !== undefined) {
      for (const file of files) {
        const arr = result.get(file.name) ?? [];
        file.hunks.forEach((hunk, hunkIndex) => {
          const anchor = hunkChangeAnchor(hunk);
          arr.push({
            side: anchor.side,
            lineNumber: anchor.lineNumber,
            metadata: { kind: "hunk", hunkIndex },
          });
        });
        result.set(file.name, arr);
      }
    }
    return result;
  }, [comments, draft, files, onDiscardHunk]);

  if (loading) {
    return (
      <div className="p-8">
        <LoadingCursor label="Loading diff…" />
      </div>
    );
  }
  if (error !== null) {
    return <div className="p-8 text-sm text-destructive">{error}</div>;
  }
  if (files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-sm">
        <div className="font-medium">Nothing to review</div>
        <div className="text-muted-foreground">{emptyHint(target)}</div>
      </div>
    );
  }

  return (
    // Virtualizer windows each FileDiff (only the ~viewport ±1000px slice of
    // lines gets DOM; IntersectionObserver wakes files as they approach), so
    // it must be the scroll container — the wrapper div only carries the ref
    // for the scroll-to-file animation above.
    <div ref={containerRef} className="h-full">
      {/* Trailing gutter, so the last file's last lines clear the floating
          bars that hang over the bottom of the pane (the assign bar). */}
      <Virtualizer className="diff-pane h-full overflow-auto pb-20">
        {files.map((file) => (
          <FileDiffSection
            key={`${target.kind}-${file.prevName ?? ""}-${file.name}`}
            file={file}
            theme={theme}
            diffStyle={diffStyle}
            connectorsEnabled={connectorsEnabled}
            expandUnchanged={expandedFiles.has(file.name)}
            onToggleExpandUnchanged={toggleExpanded}
            loadDiffFiles={loadDiffFiles}
            annotations={annotationsByFile.get(file.name) ?? NO_ANNOTATIONS}
            selectedLines={
              draft !== null && draft.filePath === file.name
                ? {
                    start: draft.lineNumber,
                    end: draft.lineNumber,
                    side: draft.side,
                    endSide: draft.side,
                  }
                : null
            }
            onDraftOpen={onDraftOpen}
            onDraftCancel={onDraftCancel}
            onEditFile={onEditFile}
            onShowFileHistory={onShowFileHistory}
            onDiscardFile={onDiscardFile}
            onDiscardHunk={onDiscardHunk}
            onCommentSubmit={onCommentSubmit}
            onCommentDelete={onCommentDelete}
            onCommentEdit={onCommentEdit}
            onCommentReply={onCommentReply}
            languageEnabled={target.kind === "worktree"}
            onOpenLocation={onOpenLocation}
          />
        ))}
      </Virtualizer>
    </div>
  );
}
