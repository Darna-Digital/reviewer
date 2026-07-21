import { type LineAnnotation } from "@pierre/diffs"
import { File } from "@pierre/diffs/react"
import { IconX } from "@tabler/icons-react"
import { useMemo } from "react"
import {
  CommentThread,
  DraftCard,
  type DraftLocation,
} from "@/interactions/comments/components/comment-thread"
import { THEMES, useLangReady } from "@/components/editor/highlighter"
import { Button } from "@/components/ui/button"
import { useFile } from "@/lib/queries"
import type { ReviewComment } from "@byconvo/core"
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

interface CodeViewProps {
  path: string
  theme: Theme
  onEdit: (path: string) => void
  onClose: () => void
  /** Local review comments anchored to this file (optional — omit to disable). */
  comments?: ReadonlyArray<ReviewComment>
  draft?: DraftLocation | null
  onDraftOpen?: (draft: DraftLocation) => void
  onDraftCancel?: () => void
  onCommentSubmit?: (location: DraftLocation, body: string) => Promise<void>
  onCommentDelete?: (comment: ReviewComment) => Promise<void>
}

export function CodeView({
  path,
  theme,
  onEdit,
  onClose,
  comments,
  draft = null,
  onDraftOpen,
  onDraftCancel,
  onCommentSubmit,
  onCommentDelete,
}: CodeViewProps) {
  const file = useFile(path)
  const langReady = useLangReady(path)
  const commentsEnabled =
    onCommentSubmit !== undefined && onCommentDelete !== undefined

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
    return out
  }, [comments, draft, path])

  if (file.isPending || !langReady) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading {path}…</div>
    )
  }
  if (file.error || file.data === undefined) {
    return (
      <div className="p-8 text-sm text-destructive">Could not open {path}</div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <section className="diff-file" data-file-anchor={path}>
        {/* Remount per file: the underlying File instance doesn't re-highlight
            when only its `file` prop changes, so navigating between files would
            otherwise show the new contents unhighlighted until a reload. */}
        <File<AnnotationMeta>
          key={path}
          file={{ name: path, contents: file.data.contents }}
          disableWorkerPool
          options={{
            theme: THEMES,
            themeType: theme,
            overflow: "wrap",
            stickyHeader: false,
            enableGutterUtility: commentsEnabled,
            onGutterUtilityClick: commentsEnabled
              ? (range) =>
                  onDraftOpen?.({
                    filePath: path,
                    side: FILE_COMMENT_SIDE,
                    lineNumber: range.end,
                  })
              : undefined,
            onLineNumberClick: commentsEnabled
              ? (props) =>
                  onDraftOpen?.({
                    filePath: path,
                    side: FILE_COMMENT_SIDE,
                    lineNumber: props.lineNumber,
                  })
              : undefined,
          }}
          selectedLines={
            commentsEnabled
              ? draft !== null && draft.filePath === path
                ? { start: draft.lineNumber, end: draft.lineNumber }
                : null
              : undefined
          }
          lineAnnotations={commentsEnabled ? annotations : undefined}
          renderAnnotation={
            commentsEnabled
              ? (annotation) => {
                  const meta = annotation.metadata
                  if (meta === undefined) return null
                  if (meta.kind === "draft") {
                    return (
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
                  return (
                    <CommentThread
                      comments={meta.comments}
                      onDelete={onCommentDelete}
                    />
                  )
                }
              : undefined
          }
          renderHeaderMetadata={(meta) => (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onEdit(meta.name)}
              >
                Edit
              </Button>
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
    </div>
  )
}
