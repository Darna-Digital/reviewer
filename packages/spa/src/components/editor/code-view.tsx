import { DIFFS_TAG_NAME } from "@pierre/diffs";
import type { DiffsEditableComponent, LineAnnotation } from "@pierre/diffs";
import { EditProvider, File, Virtualizer } from "@pierre/diffs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CommentThread,
  DraftCard,
  type DraftLocation,
} from "@/interactions/comments/components/comment-thread";
import {
  SELECTION_COMMENT_CSS,
  selectionCommentAction,
} from "@/interactions/comments/components/selection-comment-action";
import { SelectionCommentPopover } from "@/interactions/comments/components/selection-comment-popover";
import {
  rectAnchor,
  type VirtualAnchor,
} from "@/interactions/language/functions/anchors";
import { codeRootsWithin } from "@/lib/code-root";
import { commentLineFor } from "@/interactions/comments/functions/selection-anchor";
import { ProblemsBar } from "@/interactions/language/components/problems-bar";
import { useLanguageLayer } from "@/interactions/language/components/language-layer";
import { lineOfDiagnostic } from "@/interactions/language/functions/language.functions";
import {
  useRevealLine,
  type RevealTarget,
} from "@/interactions/language/components/use-reveal-line";
import { useFindInFile } from "@/interactions/find-in-file/adapters/find-in-file.hook.adapter";
import { useFormatOnSave } from "@/interactions/formatting/adapters/formatting.hook.adapter";
import { useVim } from "@/interactions/vim/adapters/vim.hook.adapter";
import { useFolding } from "@/interactions/folding/adapters/folding.hook.adapter";
import {
  THEMES,
  fileForHighlighting,
  useHighlightPrimed,
  useLangReady,
} from "@/components/editor/highlighter";
import { UnsupportedFile } from "@/components/editor/unsupported-file";
import {
  useFileEditing,
  type SelectionActionContext,
} from "@/components/editor/use-file-editing";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { selectionShadingCSS } from "@/lib/code-selection-css";
import { useFile } from "@/lib/queries";
import { useUiPrefs } from "@/lib/ui-prefs";
import type { ReviewComment } from "@byconvo/core/comments";
import type { Diagnostic, FileEdits, Location } from "@byconvo/core/language";
import type { VimFoldAction } from "@/interactions/vim/interfaces/vim.interfaces";
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
  | { readonly kind: "draft"; readonly body?: string };

interface CodeViewProps {
  path: string;
  theme: Theme;
  /** Called after the buffer is written to disk, so git state can refresh. */
  onSaved?: () => void;
  /** Whether this file has unsaved changes — the tab strip shows a marker. */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Where this file's own readouts — the Vim mode line — render. Saving is not
   * among them: an unsaved buffer says so on its tab, and ⌘S writes it, as in
   * any editor. Omit to leave the file without them.
   */
  actionsSlot?: HTMLElement | null;
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
  const prefs = useUiPrefs();
  const langReady = useLangReady(path, true);
  const contents = file.data?.contents;
  const highlightFile = useMemo(
    () => (contents === undefined ? null : fileForHighlighting(path, contents)),
    [path, contents]
  );
  // The editable view renders off the pool, so there is nothing to prime.
  const highlightPrimed = useHighlightPrimed(highlightFile, false);
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

  // `useFolding` needs the file component to give it the collapsed-region hooks
  // it has none of, and it only turns up when the editor attaches. The ref
  // breaks the cycle: folding is declared below, since it needs the editor this
  // call produces.
  const foldAttach = useRef<
    ((component: DiffsEditableComponent<undefined>) => void) | null
  >(null);
  // Starting a comment. The gutter `+` has nowhere left to live — an editable
  // view takes the caret on every click — so a comment begins from the passage
  // it is about: select, and the editor floats an offer over the selection.
  const draftRef = useRef<((draft: DraftLocation) => void) | undefined>(
    undefined
  );
  draftRef.current = commentsEnabled ? onDraftOpen : undefined;

  // Saving a file formats it, when the project says how and the user wants it.
  const formatting = useFormatOnSave();

  const buffer = useFileEditing({
    path,
    loadedContents: file.data?.contents,
    onSaved: useCallback(() => onSaved?.(), [onSaved]),
    formatBeforeSave: formatting.formatBeforeSave,
    onAttach: useCallback((component: DiffsEditableComponent<undefined>) => {
      foldAttach.current?.(component);
    }, []),
    renderSelectionAction: useCallback(
      (context: SelectionActionContext) =>
        selectionCommentAction({
          onComment: () => {
            const lineNumber = commentLineFor(context.selection);
            if (lineNumber === null) return;
            draftRef.current?.({
              filePath: path,
              side: FILE_COMMENT_SIDE,
              lineNumber,
            });
          },
          close: context.close,
        }),
      [path]
    ),
  });

  useEffect(() => {
    onDirtyChange?.(buffer.dirty);
  }, [buffer.dirty, onDirtyChange]);

  // The editor keeps offering to comment for as long as the selection stands,
  // which would put the offer on top of the composer it just opened. The flag
  // rides on the shadow host, where the popover's own stylesheet can see it —
  // `unsafeCSS` is read once at mount, so the CSS cannot be made conditional.
  /** Open a comment on whatever the editor currently has selected. */
  const commentOnSelection = useCallback(() => {
    const selection = buffer.editor?.getState().selections?.at(-1);
    if (selection === undefined) return;
    const lineNumber = commentLineFor(selection);
    if (lineNumber === null) return;
    draftRef.current?.({ filePath: path, side: FILE_COMMENT_SIDE, lineNumber });
  }, [buffer.editor, path]);

  // Where Vim's own offer hangs: the last band of the selection it painted.
  const selectionAnchor = useCallback((): VirtualAnchor | null => {
    const container = scrollWrapper.current;
    if (container === null) return null;
    for (const root of codeRootsWithin(container)) {
      const bands = root.querySelectorAll("[data-selection-range]");
      const last = bands[bands.length - 1];
      if (last !== undefined) return rectAnchor(last.getBoundingClientRect());
    }
    return null;
  }, []);

  const drafting = draft !== null && draft.filePath === path;
  useEffect(() => {
    const host = scrollWrapper.current?.querySelector(DIFFS_TAG_NAME);
    if (host === null || host === undefined) return;
    if (drafting) host.setAttribute("data-drafting", "");
    else host.removeAttribute("data-drafting");
  }, [drafting]);

  // Report the file as saved when it goes away, so a stale marker cannot
  // outlive the view that owned it.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const folding = useFolding({
    editor: buffer.editor,
    contents: contents ?? "",
    subscribe: buffer.subscribe,
    isFocused: buffer.isFocused,
  });
  foldAttach.current = folding.attach;

  // Modal editing, when the user has asked for it.
  const vim = useVim({
    editor: buffer.editor,
    enabled: prefs.vimMode,
    isFocused: buffer.isFocused,
    subscribe: buffer.subscribe,
    visibleFrom: folding.visibleFrom,
    onFold: useCallback(
      (action: VimFoldAction, line: number) => {
        if (action === "toggle") folding.toggle(line);
        else if (action === "close") folding.close(line);
        else if (action === "open") folding.open(line);
        else if (action === "closeAll") folding.closeAll();
        else folding.openAll();
      },
      [folding]
    ),
  });

  // The IDE layer: diagnostics, go-to-definition and find-usages, driven by
  // `@pierre/diffs` token hooks. Only active when the host can navigate.
  const language = useLanguageLayer({
    path,
    editor: buffer.editor,
    subscribe: buffer.subscribe,
    isFocused: buffer.isFocused,
    // While `d` means delete, a list offering to finish a word is in the way —
    // Vim's insert mode is the only one where typing means typing.
    completionsEnabled: vim.mode === null || vim.mode === "insert",
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
    return out;
  }, [comments, draft, path]);

  // Diagnostics stay out of the annotation slot: rows appearing under lines
  // while typing shove the code around under the caret. They live in the
  // problems bar below instead, with the squiggles still marking the spot.
  const annotationsEnabled = commentsEnabled;

  // The Virtualizer's own root div owns the scroll — it has to, in order to
  // window its rendering — and it is the wrapper's only child.
  const getScroller = useCallback(() => {
    const scroller = scrollWrapper.current?.firstElementChild;
    return scroller instanceof HTMLElement ? scroller : null;
  }, []);

  const find = useFindInFile({
    path,
    contents: contents ?? "",
    editor: buffer.editor,
    subscribe: buffer.subscribe,
    getScroller,
  });

  // Whether the problems bar is open on its list, kept across files: leaving
  // it open is a way of working, not a per-file setting.
  const [problemsOpen, setProblemsOpen] = useState(false);
  const toggleProblems = useCallback(
    () => setProblemsOpen((open) => !open),
    []
  );
  const jumpToProblem = useCallback(
    (problem: Diagnostic) => onOpenLocation?.(path, lineOfDiagnostic(problem)),
    [onOpenLocation, path]
  );

  // The view keeps one `onPostRender`, and four layers paint from it: the
  // diagnostic underlines, the find highlight, the relative line numbers and
  // the folds.
  const languagePostRender = language.viewOptions.onPostRender;
  const findPostRender = find.viewOptions.onPostRender;
  const vimPostRender = vim.viewOptions.onPostRender;
  const foldPostRender = folding.viewOptions.onPostRender;
  const onPostRender = useCallback(
    (
      node: HTMLElement,
      instance: unknown,
      phase: "mount" | "update" | "unmount"
    ) => {
      languagePostRender(node, instance, phase);
      findPostRender(node, instance, phase);
      vimPostRender(node, instance, phase);
      foldPostRender(node, instance, phase);
    },
    [languagePostRender, findPostRender, vimPostRender, foldPostRender]
  );

  // Line count drives the first scroll estimate for a line that has not been
  // rendered yet; zero until the file loads, which simply means "start at top".
  // The hook is called above the loading and error returns below, so a request
  // that arrives while the file is still being read has something waiting for
  // the view to mount — that first jump is the one that used to be lost.
  useRevealLine(
    getScroller,
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
    // scrolling root, which is its first child.
    <div ref={scrollWrapper} className="relative h-full">
      {/* Trailing gutter: the last lines have to clear the floating bars that
          hang over the bottom of the pane (the assign bar, the problems bar),
          and scrolling a little past the end is how an editor behaves anyway. */}
      <Virtualizer className="h-full overflow-auto pb-20">
        {/* The view builds its own editor from this factory as it mounts,
            rather than being handed one that exists whether or not a file is
            open — see `useFileEditing`. */}
        <EditProvider createEditor={buffer.createEditor}>
          <section className="diff-file" data-file-anchor={path}>
            {/* Remount per file: the underlying File instance neither
            re-highlights on a `file` prop change nor attaches the editor after
            mount, so navigating would otherwise leave a stale view. */}
            <File<AnnotationMeta>
              key={path}
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
                // Token hooks + the post-render pass that underlines problems.
                ...language.viewOptions,
                // Both layers paint from the same callback and into the same
                // stylesheet, and the view keeps one of each.
                onPostRender,
                unsafeCSS: `${selectionShadingCSS}\n${language.viewOptions.unsafeCSS}\n${find.viewOptions.unsafeCSS}\n${vim.viewOptions.unsafeCSS}\n${folding.viewOptions.unsafeCSS}\n${SELECTION_COMMENT_CSS}`,
              }}
              edit
              /* The editable view snapshots the rendered code when the editor
               attaches, so a worker highlight landing afterwards would never
               reach it; `useLangReady` primes the main-thread highlighter so
               the first paint is coloured anyway. */
              disableWorkerPool
              lineAnnotations={annotationsEnabled ? annotations : undefined}
              renderAnnotation={
                annotationsEnabled
                  ? (annotation) => {
                      const meta = annotation.metadata;
                      if (meta === undefined) return null;
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
          createPortal(vim.status, actionsSlot)}
        {language.card}
        {language.completions}
        {language.menu}
        {/* The editor makes its own offer over a selection the pointer made; a
            Vim visual selection is set programmatically, so it never gets one
            and this one stands in. */}
        {vim.hasSelection && commentsEnabled && !drafting && (
          <SelectionCommentPopover
            anchor={selectionAnchor}
            onComment={commentOnSelection}
          />
        )}
      </Virtualizer>
      {/* Floats over the code rather than sitting under it: diagnostics come
          and go while typing, and a bar that resizes the view would shove the
          text around under the caret every time the last problem cleared. */}
      <ProblemsBar
        diagnostics={language.diagnostics}
        expanded={problemsOpen}
        onToggle={toggleProblems}
        onSelect={jumpToProblem}
        className="absolute inset-x-0 bottom-0 z-10"
      />
      {find.bar}
    </div>
  );
}
