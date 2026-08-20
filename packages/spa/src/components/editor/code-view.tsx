import { type LineAnnotation } from "@pierre/diffs";
import { EditProvider, File, Virtualizer } from "@pierre/diffs/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  CommentThread,
  DraftCard,
  type DraftLocation,
} from "@/interactions/comments/components/comment-thread";
import {
  DiagnosticsAnnotation,
  DiagnosticsSummary,
} from "@/interactions/language/components/diagnostics-annotation";
import {
  useLanguageLayer,
  type DiagnosticsAnnotationMeta,
} from "@/interactions/language/components/language-layer";
import {
  useRevealLine,
  type RevealTarget,
} from "@/interactions/language/components/use-reveal-line";
import {
  THEMES,
  fileForHighlighting,
  useHighlightPrimed,
  useLangReady,
} from "@/components/editor/highlighter";
import { UnsupportedFile } from "@/components/editor/unsupported-file";
import { useFileEditing } from "@/components/editor/use-file-editing";
import { Button } from "@/components/ui/button";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { selectionShadingCSS } from "@/lib/code-selection-css";
import { useFile } from "@/lib/queries";
import type { ReviewComment } from "@byconvo/core/comments";
import type { FileEdits, Location } from "@byconvo/core/language";
import { writeFileEdits } from "@/interactions/language/adapters/language.hook.adapter";
import type { Theme } from "@/lib/ui-prefs";

// Comments on a plain (non-diff) file are always anchored to the current
// content, i.e. the "additions" side of an eventual worktree diff.
const FILE_COMMENT_SIDE = "additions" as const;

type AnnotationMeta =
  | {
      readonly kind: "comments";
      readonly comments: ReadonlyArray<ReviewComment>;
    }
  // See `diff-pane`: the body travels with the draft so a composer reopened
  // after a refused write comes back holding what was typed.
  | { readonly kind: "draft"; readonly body?: string }
  | DiagnosticsAnnotationMeta;

interface CodeViewProps {
  path: string;
  theme: Theme;
  /** Called after the buffer is written to disk, so git state can refresh. */
  onSaved?: () => void;
  /** Whether this file has unsaved changes — the tab strip shows a marker. */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Where this file's own controls (Save, Done, the problem count) render —
   * the end of the tab strip above the view, so the file and everything acting
   * on it stay on one line. Omit to leave the file without them.
   */
  actionsSlot?: HTMLElement | null;
  /**
   * Reading and editing stay separate — reading is what the gutter `+` needs,
   * since an editable view takes the caret on every click. Editing is switched
   * on from the file's tab, which is why the host owns the flag; omit it for a
   * view that is only ever read.
   */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  /**
   * Open another file at a line — go-to-definition and find-usages need it.
   * Omit to leave the IDE layer off.
   */
  onOpenLocation?: (path: string, lineNumber: number) => void;
  /** Scroll this one-based line into view and flash it. */
  reveal?: RevealTarget | null;
  /** Local review comments anchored to this file (optional — omit to disable). */
  comments?: ReadonlyArray<ReviewComment>;
  draft?: DraftLocation | null;
  onDraftOpen?: (draft: DraftLocation) => void;
  onDraftCancel?: () => void;
  onCommentSubmit?: (location: DraftLocation, body: string) => Promise<void>;
  onCommentDelete?: (comment: ReviewComment) => Promise<void>;
  onCommentEdit?: (comment: ReviewComment, body: string) => Promise<void>;
}

export function CodeView({
  path,
  theme,
  onSaved,
  onDirtyChange,
  actionsSlot,
  editing = false,
  onEditingChange,
  onOpenLocation,
  reveal = null,
  comments,
  draft = null,
  onDraftOpen,
  onDraftCancel,
  onCommentSubmit,
  onCommentDelete,
  onCommentEdit,
}: CodeViewProps) {
  const file = useFile(path);
  const langReady = useLangReady(path, editing);
  const contents = file.data?.contents;
  const highlightFile = useMemo(
    () => (contents === undefined ? null : fileForHighlighting(path, contents)),
    [path, contents]
  );
  // Editing renders off the pool, so there is nothing to prime for it.
  const highlightPrimed = useHighlightPrimed(highlightFile, !editing);
  const scrollWrapper = useRef<HTMLDivElement>(null);
  const commentsEnabled =
    onCommentSubmit !== undefined && onCommentDelete !== undefined;

  // A quick fix can touch a file that is not open — an import added to a
  // barrel, say. Those are read, edited and written back through the file API,
  // since the editor only owns the buffer on screen.
  const applyForeignEdits = useCallback(
    (files: ReadonlyArray<FileEdits>) => void writeFileEdits(files),
    []
  );

  const buffer = useFileEditing(
    path,
    file.data?.contents,
    useCallback(() => onSaved?.(), [onSaved])
  );

  useEffect(() => {
    onDirtyChange?.(buffer.dirty);
  }, [buffer.dirty, onDirtyChange]);

  // Report the file as saved when it goes away, so a stale marker cannot
  // outlive the view that owned it.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const stopEditing = () => {
    if (buffer.dirty && !window.confirm(`Discard unsaved changes in ${path}?`))
      return;
    buffer.discard();
    onEditingChange?.(false);
  };

  // The IDE layer: diagnostics, go-to-definition and find-usages, driven by
  // `@pierre/diffs` token hooks. Only active when the host can navigate.
  const language = useLanguageLayer({
    path,
    editor: buffer.editor,
    subscribe: buffer.subscribe,
    getContainer: useCallback(() => scrollWrapper.current, []),
    onApplyForeignEdits: applyForeignEdits,
    // Diagnostics follow what is on screen, not what is on disk.
    contents: buffer.bufferForAnalysis,
    enabled: onOpenLocation !== undefined,
    onOpenLocation: useCallback(
      (location: Location) =>
        onOpenLocation?.(location.path, location.range.start.line + 1),
      [onOpenLocation]
    ),
  });

  // Group this file's comments (and the open draft) into per-line annotations.
  const annotations = useMemo<Array<LineAnnotation<AnnotationMeta>>>(() => {
    const byLine = new Map<number, ReviewComment[]>();
    for (const c of comments ?? []) {
      const bucket = byLine.get(c.lineNumber);
      if (bucket) bucket.push(c);
      else byLine.set(c.lineNumber, [c]);
    }
    const out: Array<LineAnnotation<AnnotationMeta>> = [];
    for (const [lineNumber, group] of byLine) {
      out.push({ lineNumber, metadata: { kind: "comments", comments: group } });
    }
    if (draft !== null && draft.filePath === path) {
      out.push({
        lineNumber: draft.lineNumber,
        metadata:
          draft.body === undefined
            ? { kind: "draft" }
            : { kind: "draft", body: draft.body },
      });
    }
    // Diagnostics share the annotation slot with comments; a line can carry
    // both, and `@pierre/diffs` stacks them in order.
    out.push(...language.annotations);
    return out;
  }, [comments, draft, language.annotations, path]);

  // The annotation slot carries diagnostics as well as comments, so it stays on
  // whenever either has something to show.
  const annotationsEnabled = commentsEnabled || language.annotations.length > 0;
  const gutterCommentsEnabled = commentsEnabled && !editing;

  // Line count drives the first scroll estimate for a line that has not been
  // rendered yet; zero until the file loads, which simply means "start at top".
  // The hook is called above the loading and error returns below, so a request
  // that arrives while the file is still being read has something waiting for
  // the view to mount — that first jump is the one that used to be lost.
  useRevealLine(
    // The Virtualizer's own root div owns the scroll — it has to, in order to
    // window its rendering — and it is the wrapper's only child.
    useCallback(() => {
      const scroller = scrollWrapper.current?.firstElementChild;
      return scroller instanceof HTMLElement ? scroller : null;
    }, []),
    reveal,
    file.data === undefined ? 0 : file.data.contents.split("\n").length,
    path
  );

  if (file.isPending || !langReady || !highlightPrimed) {
    return (
      <div className="p-8">
        <LoadingCursor label={`Loading ${path}…`} />
      </div>
    );
  }
  if (file.error || file.data === undefined || highlightFile === null) {
    return (
      <div className="p-8 text-sm text-destructive">Could not open {path}</div>
    );
  }
  // Binary content has no lines to render — handing it to the viewer throws
  // from inside its own line lookup, taking the pane down with it.
  if (file.data.binary) {
    return <UnsupportedFile path={path} sizeBytes={file.data.sizeBytes} />;
  }

  return (
    // Virtualizer windows the file: only the viewport (±overscan) worth of
    // lines is materialized in the DOM, so large files open instantly. The
    // wrapper exists so `useRevealLine` can reach the Virtualizer's own
    // scrolling root, which is its only child.
    <div ref={scrollWrapper} className="h-full">
      {/* Trailing gutter: the last lines have to clear the floating bars that
          hang over the bottom of the pane (the assign bar), and scrolling a
          little past the end is how an editor behaves anyway. */}
      <Virtualizer className="h-full overflow-auto pb-20">
        {/* The editable view builds its own editor from this factory when a
            session opens, rather than being handed one that exists whether or
            not anyone is editing — see `useFileEditing`. */}
        <EditProvider createEditor={buffer.createEditor}>
          <section className="diff-file" data-file-anchor={path}>
            {/* Remount per file, and when editing is switched on or off: the
            underlying File instance neither re-highlights on a `file` prop
            change nor attaches the editor after mount, so navigating or
            starting to edit would otherwise leave a stale view. */}
            <File<AnnotationMeta>
              key={`${path}:${editing}`}
              file={highlightFile}
              options={{
                theme: THEMES,
                themeType: theme,
                overflow: "wrap",
                stickyHeader: false,
                // The path, the file's actions and the trail that led here all
                // belong on one line — the crumb bar above owns it, so the
                // view's own header would only say the same thing twice.
                disableFileHeader: true,
                enableGutterUtility: gutterCommentsEnabled,
                onGutterUtilityClick: gutterCommentsEnabled
                  ? (range) =>
                      onDraftOpen?.({
                        filePath: path,
                        side: FILE_COMMENT_SIDE,
                        lineNumber: range.end,
                      })
                  : undefined,
                onLineNumberClick: gutterCommentsEnabled
                  ? (props) =>
                      onDraftOpen?.({
                        filePath: path,
                        side: FILE_COMMENT_SIDE,
                        lineNumber: props.lineNumber,
                      })
                  : undefined,
                // Token hooks + the post-render pass that underlines problems.
                ...language.viewOptions,
                unsafeCSS: `${selectionShadingCSS}\n${language.viewOptions.unsafeCSS}`,
              }}
              edit={editing}
              /* The editable view snapshots the rendered code when the editor
               attaches, so a worker highlight landing afterwards would never
               reach it; `useLangReady` primes the main-thread highlighter for
               that case so the first paint is coloured anyway. Reading goes
               through the pool, off the main thread. */
              disableWorkerPool={editing}
              selectedLines={
                gutterCommentsEnabled
                  ? draft !== null && draft.filePath === path
                    ? { start: draft.lineNumber, end: draft.lineNumber }
                    : null
                  : undefined
              }
              lineAnnotations={annotationsEnabled ? annotations : undefined}
              renderAnnotation={
                annotationsEnabled
                  ? (annotation) => {
                      const meta = annotation.metadata;
                      if (meta === undefined) return null;
                      if (meta.kind === "diagnostics") {
                        return (
                          <DiagnosticsAnnotation
                            diagnostics={meta.diagnostics}
                          />
                        );
                      }
                      if (meta.kind === "draft") {
                        return onCommentSubmit === undefined ? null : (
                          <DraftCard
                            onCancel={() => onDraftCancel?.()}
                            {...(meta.body === undefined
                              ? {}
                              : { initialBody: meta.body })}
                            onSubmit={(body) =>
                              onCommentSubmit(
                                {
                                  filePath: path,
                                  side: FILE_COMMENT_SIDE,
                                  lineNumber: annotation.lineNumber,
                                },
                                body
                              )
                            }
                          />
                        );
                      }
                      return onCommentDelete === undefined ? null : (
                        <CommentThread
                          comments={meta.comments}
                          onDelete={onCommentDelete}
                          onEdit={onCommentEdit}
                        />
                      );
                    }
                  : undefined
              }
            />
          </section>
        </EditProvider>
        {actionsSlot !== null &&
          actionsSlot !== undefined &&
          createPortal(
            <>
              <DiagnosticsSummary counts={language.counts} />
              {editing && (
                <>
                  {buffer.dirty && (
                    <Button
                      size="xs"
                      disabled={buffer.saving}
                      onClick={buffer.save}
                    >
                      {buffer.saving ? "Saving…" : "Save"}
                    </Button>
                  )}
                  <Button variant="ghost" size="xs" onClick={stopEditing}>
                    Done
                  </Button>
                </>
              )}
            </>,
            actionsSlot
          )}
        {language.card}
        {language.completions}
        {language.menu}
      </Virtualizer>
    </div>
  );
}
