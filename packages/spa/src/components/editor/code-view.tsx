import { type LineAnnotation } from "@pierre/diffs"
import { File, Virtualizer } from "@pierre/diffs/react"
import { IconHistory, IconX } from "@tabler/icons-react"
import { useCallback, useMemo, useRef } from "react"
import {
  CommentThread,
  DraftCard,
  type DraftLocation,
} from "@/interactions/comments/components/comment-thread"
import { useSelectionActions } from "@/interactions/code-actions/components/use-selection-actions"
import {
  DiagnosticsAnnotation,
  DiagnosticsSummary,
} from "@/interactions/language/components/diagnostics-annotation"
import {
  useLanguageLayer,
  type DiagnosticsAnnotationMeta,
} from "@/interactions/language/components/language-layer"
import {
  useRevealLine,
  type RevealTarget,
} from "@/interactions/language/components/use-reveal-line"
import { THEMES, useLangReady } from "@/components/editor/highlighter"
import { Button } from "@/components/ui/button"
import { LoadingCursor } from "@/components/ui/loading-cursor"
import { useFile } from "@/lib/queries"
import type { ReviewComment } from "@byconvo/core/comments"
import type { Location } from "@byconvo/core/language"
import type { Theme } from "@/lib/ui-prefs"

// Comments on a plain (non-diff) file are always anchored to the current
// content, i.e. the "additions" side of an eventual worktree diff.
const FILE_COMMENT_SIDE = "additions" as const

type AnnotationMeta =
  | {
      readonly kind: "comments"
      readonly comments: ReadonlyArray<ReviewComment>
    }
  | { readonly kind: "draft" }
  | DiagnosticsAnnotationMeta

interface CodeViewProps {
  path: string
  theme: Theme
  /** Open the editor for `path`, revealing `lineNumber`. */
  onEdit: (path: string, lineNumber: number) => void
  onClose: () => void
  /** Open this file's commit history in the bottom dock. */
  onShowHistory?: (path: string) => void
  /**
   * Open another file at a line — go-to-definition and find-usages need it.
   * Omit to leave the IDE layer off.
   */
  onOpenLocation?: (path: string, lineNumber: number) => void
  /** Scroll this one-based line into view and flash it. */
  reveal?: RevealTarget | null
  /** Local review comments anchored to this file (optional — omit to disable). */
  comments?: ReadonlyArray<ReviewComment>
  draft?: DraftLocation | null
  onDraftOpen?: (draft: DraftLocation) => void
  onDraftCancel?: () => void
  onCommentSubmit?: (location: DraftLocation, body: string) => Promise<void>
  onCommentDelete?: (comment: ReviewComment) => Promise<void>
  onCommentEdit?: (comment: ReviewComment, body: string) => Promise<void>
}

export function CodeView({
  path,
  theme,
  onEdit,
  onClose,
  onShowHistory,
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
  const file = useFile(path)
  const langReady = useLangReady(path)
  const scrollWrapper = useRef<HTMLDivElement>(null)
  const commentsEnabled =
    onCommentSubmit !== undefined && onCommentDelete !== undefined

  // The IDE layer: diagnostics, go-to-definition and find-usages, driven by
  // `@pierre/diffs` token hooks. Only active when the host can navigate.
  const language = useLanguageLayer({
    path,
    enabled: onOpenLocation !== undefined,
    onOpenLocation: useCallback(
      (location: Location) =>
        onOpenLocation?.(location.path, location.range.start.line + 1),
      [onOpenLocation]
    ),
  })

  // Group this file's comments (and the open draft) into per-line annotations.
  const annotations = useMemo<Array<LineAnnotation<AnnotationMeta>>>(() => {
    const byLine = new Map<number, ReviewComment[]>()
    for (const c of comments ?? []) {
      const bucket = byLine.get(c.lineNumber)
      if (bucket) bucket.push(c)
      else byLine.set(c.lineNumber, [c])
    }
    const out: Array<LineAnnotation<AnnotationMeta>> = []
    for (const [lineNumber, group] of byLine) {
      out.push({ lineNumber, metadata: { kind: "comments", comments: group } })
    }
    if (draft !== null && draft.filePath === path) {
      out.push({ lineNumber: draft.lineNumber, metadata: { kind: "draft" } })
    }
    // Diagnostics share the annotation slot with comments; a line can carry
    // both, and `@pierre/diffs` stacks them in order.
    out.push(...language.annotations)
    return out
  }, [comments, draft, language.annotations, path])

  // The annotation slot carries diagnostics as well as comments, so it stays on
  // whenever either has something to show.
  const annotationsEnabled = commentsEnabled || language.annotations.length > 0

  // Select lines to act on them. This is the only way in to commenting and
  // editing now — there is no gutter button and no editor-mode toggle.
  const selection = useSelectionActions({
    capabilities: { comment: commentsEnabled, edit: true },
    suspended: draft !== null && draft.filePath === path,
    onComment: useCallback(
      (lineNumber: number) =>
        onDraftOpen?.({ filePath: path, side: FILE_COMMENT_SIDE, lineNumber }),
      [onDraftOpen, path]
    ),
    onEdit: useCallback(
      (lineNumber: number) => onEdit(path, lineNumber),
      [onEdit, path]
    ),
    getContainer: useCallback(() => scrollWrapper.current, []),
  })

  // Line count drives the first scroll estimate for a line that has not been
  // rendered yet; zero until the file loads, which simply means "start at top".
  useRevealLine(
    // The Virtualizer's own root div owns the scroll — it has to, in order to
    // window its rendering — and it is the wrapper's only child.
    useCallback(() => {
      const scroller = scrollWrapper.current?.firstElementChild
      return scroller instanceof HTMLElement ? scroller : null
    }, []),
    reveal,
    file.data === undefined ? 0 : file.data.contents.split("\n").length
  )

  if (file.isPending || !langReady) {
    return (
      <div className="p-8">
        <LoadingCursor label={`Loading ${path}…`} />
      </div>
    )
  }
  if (file.error || file.data === undefined) {
    return (
      <div className="p-8 text-sm text-destructive">Could not open {path}</div>
    )
  }

  return (
    // Virtualizer windows the file: only the viewport (±overscan) worth of
    // lines is materialized in the DOM, so large files open instantly. The
    // wrapper exists so `useRevealLine` can reach the Virtualizer's own
    // scrolling root, which is its only child.
    <div ref={scrollWrapper} className="h-full">
      <Virtualizer className="h-full overflow-auto">
        <section className="diff-file" data-file-anchor={path}>
          {/* Remount per file: the underlying File instance doesn't re-highlight
            when only its `file` prop changes, so navigating between files would
            otherwise show the new contents unhighlighted until a reload. */}
          <File<AnnotationMeta>
            key={path}
            file={{ name: path, contents: file.data.contents }}
            options={{
              theme: THEMES,
              themeType: theme,
              overflow: "wrap",
              stickyHeader: false,
              // Commenting and editing hang off the selection instead of a
              // permanent gutter button and a header control.
              ...selection.viewOptions,
              // Token hooks + the post-render pass that underlines problems.
              ...language.viewOptions,
            }}
            // Controlled only while a draft is open, so it stays highlighted.
            // Left uncontrolled otherwise: the view owns drag-selection, and
            // writing `null` every render would wipe it as it was being made.
            selectedLines={
              draft !== null && draft.filePath === path
                ? { start: draft.lineNumber, end: draft.lineNumber }
                : undefined
            }
            lineAnnotations={annotationsEnabled ? annotations : undefined}
            renderAnnotation={
              annotationsEnabled
                ? (annotation) => {
                    const meta = annotation.metadata
                    if (meta === undefined) return null
                    if (meta.kind === "diagnostics") {
                      return (
                        <DiagnosticsAnnotation diagnostics={meta.diagnostics} />
                      )
                    }
                    if (meta.kind === "draft") {
                      return onCommentSubmit === undefined ? null : (
                        <DraftCard
                          onCancel={() => onDraftCancel?.()}
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
                      )
                    }
                    return onCommentDelete === undefined ? null : (
                      <CommentThread
                        comments={meta.comments}
                        onDelete={onCommentDelete}
                        onEdit={onCommentEdit}
                      />
                    )
                  }
                : undefined
            }
            renderHeaderMetadata={(meta) => (
              <div className="flex items-center gap-2">
                <DiagnosticsSummary counts={language.counts} />
                {onShowHistory !== undefined && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="gap-1 text-muted-foreground"
                    title={`Show the commit history of ${meta.name}`}
                    onClick={() => onShowHistory(meta.name)}
                  >
                    <IconHistory className="size-3.5" />
                    History
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <IconX />
                </Button>
              </div>
            )}
          />
        </section>
        {language.card}
        {selection.bar}
      </Virtualizer>
    </div>
  )
}
