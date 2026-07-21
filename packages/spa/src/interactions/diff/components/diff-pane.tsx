import type {
  DiffLineAnnotation,
  FileDiffMetadata,
  Hunk,
  SelectedLineRange,
} from "@pierre/diffs"
import { FileDiff } from "@pierre/diffs/react"
import { IconArrowBackUp } from "@tabler/icons-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  CommentThread,
  DraftCard,
  type DraftLocation,
} from "@/interactions/comments/components/comment-thread"
import {
  DiffConnectors,
  connectorGutterCSS,
} from "@/interactions/diff/components/diff-connectors"
import type { DiffTarget } from "@/lib/api/types"
import type { CommentSide, ReviewComment } from "@byconvo/core/comments"
import type { DiffStyle, Theme } from "@/lib/ui-prefs"

export type { DraftLocation }

type AnnotationMeta =
  | {
      readonly kind: "comments"
      readonly comments: ReadonlyArray<ReviewComment>
    }
  | { readonly kind: "draft" }
  | { readonly kind: "hunk"; readonly hunkIndex: number }

interface DiffPaneProps {
  files: ReadonlyArray<FileDiffMetadata>
  theme: Theme
  diffStyle: DiffStyle
  connectors: boolean
  loading: boolean
  error: string | null
  target: DiffTarget
  comments: ReadonlyArray<ReviewComment>
  draft: DraftLocation | null
  selectedFile: string | null
  onDraftOpen: (draft: DraftLocation) => void
  onDraftCancel: () => void
  onEditFile: (path: string) => void
  /** Discard a file's worktree changes (revert to HEAD). Only wired in commit
   * mode, where the diff is the working tree; absent means no discard control. */
  onDiscardFile?: (path: string) => void
  /** Discard a single hunk of a file's worktree diff. Only wired in commit mode;
   * absent means no per-hunk discard control is rendered. */
  onDiscardHunk?: (path: string, hunkIndex: number) => void
  onCommentSubmit: (location: DraftLocation, body: string) => Promise<void>
  onCommentDelete: (comment: ReviewComment) => Promise<void>
  onCommentReply: (comment: ReviewComment, body: string) => Promise<void>
}

const emptyHint = (target: DiffTarget): string => {
  switch (target.kind) {
    case "worktree":
      return "Working tree is clean — make some changes and hit refresh."
    case "range":
      return "These refs are identical."
    case "commit":
      return "This commit has no textual changes."
    case "pull":
      return "This pull request has no diff."
  }
}

const THEMES = { light: "github-light", dark: "github-dark" } as const

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
  let addition = hunk.additionStart
  let deletion = hunk.deletionStart
  let sawContext = false
  for (const block of hunk.hunkContent) {
    if (block.type === "context") {
      addition += block.lines
      deletion += block.lines
      sawContext = true
      continue
    }
    return block.additions > 0
      ? { side: "additions", lineNumber: sawContext ? addition - 1 : addition }
      : { side: "deletions", lineNumber: sawContext ? deletion - 1 : deletion }
  }
  return { side: "additions", lineNumber: hunk.additionStart }
}

interface FileDiffSectionProps {
  file: FileDiffMetadata
  theme: Theme
  diffStyle: DiffStyle
  connectorsEnabled: boolean
  annotations: ReadonlyArray<DiffLineAnnotation<AnnotationMeta>>
  selectedLines: SelectedLineRange | null
  onDraftOpen: (draft: DraftLocation) => void
  onDraftCancel: () => void
  onEditFile: (path: string) => void
  onDiscardFile?: (path: string) => void
  onDiscardHunk?: (path: string, hunkIndex: number) => void
  onCommentSubmit: (location: DraftLocation, body: string) => Promise<void>
  onCommentDelete: (comment: ReviewComment) => Promise<void>
  onCommentReply: (comment: ReviewComment, body: string) => Promise<void>
}

function FileDiffSection({
  file,
  theme,
  diffStyle,
  connectorsEnabled,
  annotations,
  selectedLines,
  onDraftOpen,
  onDraftCancel,
  onEditFile,
  onDiscardFile,
  onDiscardHunk,
  onCommentSubmit,
  onCommentDelete,
  onCommentReply,
}: FileDiffSectionProps) {
  // Callback-ref state (not a ref object): DiffConnectors reads the section in a
  // layout effect, which fires bottom-up, so a child would see a parent ref as
  // null. The setter only fires on mount.
  const [sectionEl, setSectionEl] = useState<HTMLElement | null>(null)
  const recomputeConnectors = useRef<() => void>(() => {})
  const onPostRender = useCallback(() => recomputeConnectors.current(), [])

  return (
    <section
      ref={setSectionEl}
      className="diff-file relative border-b"
      data-file-anchor={file.name}
    >
      <FileDiff<AnnotationMeta>
        fileDiff={file}
        disableWorkerPool
        selectedLines={selectedLines}
        options={{
          theme: THEMES,
          themeType: theme,
          diffStyle,
          lineDiffType: "word",
          overflow: diffStyle === "split" ? "scroll" : "wrap",
          stickyHeader: false,
          enableGutterUtility: true,
          unsafeCSS: connectorsEnabled ? connectorGutterCSS : undefined,
          onPostRender: connectorsEnabled ? onPostRender : undefined,
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
            {onDiscardFile !== undefined && (
              // Revert this file to HEAD. Available for every change type
              // (a deletion is restored, an addition removed).
              <Button
                variant="ghost"
                size="xs"
                className="gap-1 text-muted-foreground hover:text-destructive"
                title={`Discard changes in ${meta.name}`}
                onClick={() => {
                  if (
                    window.confirm(
                      `Discard all changes in ${meta.name}?\n\nThis reverts the file to the last commit and cannot be undone.`
                    )
                  )
                    onDiscardFile(meta.name)
                }}
              >
                <IconArrowBackUp className="size-3.5" />
                Discard
              </Button>
            )}
            {meta.type !== "deleted" && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onEditFile(meta.name)}
              >
                Edit
              </Button>
            )}
          </div>
        )}
        lineAnnotations={
          annotations as Array<DiffLineAnnotation<AnnotationMeta>>
        }
        renderAnnotation={(annotation) => {
          const meta = annotation.metadata
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
            )
          }
          if (meta.kind === "draft") {
            return (
              <DraftCard
                onCancel={onDraftCancel}
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
            )
          }
          return (
            <CommentThread
              comments={meta.comments}
              onDelete={onCommentDelete}
              onReply={onCommentReply}
            />
          )
        }}
      />
      <DiffConnectors
        section={sectionEl}
        recomputeRef={recomputeConnectors}
        enabled={connectorsEnabled}
      />
    </section>
  )
}

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
  onDraftOpen,
  onDraftCancel,
  onEditFile,
  onDiscardFile,
  onDiscardHunk,
  onCommentSubmit,
  onCommentDelete,
  onCommentReply,
}: DiffPaneProps) {
  const connectorsEnabled = connectors && diffStyle === "split"
  const containerRef = useRef<HTMLDivElement>(null)

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
    if (selectedFile === null) return
    const container = containerRef.current
    if (container == null) return

    let active = true
    let raf = 0
    let lastFrame = 0
    const startedAt = performance.now()
    const cleanups: Array<() => void> = []

    const targetTop = (): number | null => {
      const anchor = container.querySelector(
        `[data-file-anchor="${CSS.escape(selectedFile)}"]`
      )
      if (!(anchor instanceof HTMLElement)) return null
      const max = container.scrollHeight - container.clientHeight
      return Math.min(
        anchor.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop,
        max
      )
    }

    const stop = () => {
      if (!active) return
      active = false
      cancelAnimationFrame(raf)
      for (const cleanup of cleanups) cleanup()
    }

    const frame = (now: number) => {
      if (!active) return
      lastFrame = now
      const top = targetTop()
      if (top !== null) {
        const delta = top - container.scrollTop
        container.scrollTop =
          Math.abs(delta) <= 1 ? top : container.scrollTop + delta * 0.2
      }
      // Keep following while the content settles; then stop.
      if (now - startedAt < 1200) raf = requestAnimationFrame(frame)
      else stop()
    }

    for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
      container.addEventListener(type, stop, { passive: true })
      cleanups.push(() => container.removeEventListener(type, stop))
    }

    // Background-tab fallback: if rAF hasn't run (throttled), jump to target.
    const fallback = setTimeout(() => {
      if (!active || performance.now() - lastFrame < 100) return
      const top = targetTop()
      if (top !== null) container.scrollTop = top
    }, 250)
    cleanups.push(() => clearTimeout(fallback))

    raf = requestAnimationFrame(frame)

    return stop
  }, [selectedFile, files])

  const annotationsByFile = useMemo(() => {
    const result = new Map<string, Array<DiffLineAnnotation<AnnotationMeta>>>()
    const grouped = new Map<
      string,
      {
        filePath: string
        side: CommentSide
        lineNumber: number
        comments: ReviewComment[]
      }
    >()
    for (const c of comments) {
      const key = `${c.side}:${c.lineNumber}:${c.filePath}`
      const bucket = grouped.get(key)
      if (bucket) bucket.comments.push(c)
      else
        grouped.set(key, {
          filePath: c.filePath,
          side: c.side,
          lineNumber: c.lineNumber,
          comments: [c],
        })
    }
    for (const g of grouped.values()) {
      const arr = result.get(g.filePath) ?? []
      arr.push({
        side: g.side,
        lineNumber: g.lineNumber,
        metadata: { kind: "comments", comments: g.comments },
      })
      result.set(g.filePath, arr)
    }
    if (draft !== null) {
      const arr = result.get(draft.filePath) ?? []
      arr.push({
        side: draft.side,
        lineNumber: draft.lineNumber,
        metadata: { kind: "draft" },
      })
      result.set(draft.filePath, arr)
    }
    // Anchor a "Discard hunk" control at the start of each hunk. Only in commit
    // mode (onDiscardHunk provided); hunk order here matches the server's
    // `git diff HEAD -- <path>`, so the index round-trips to the discard call.
    if (onDiscardHunk !== undefined) {
      for (const file of files) {
        const arr = result.get(file.name) ?? []
        file.hunks.forEach((hunk, hunkIndex) => {
          const anchor = hunkChangeAnchor(hunk)
          arr.push({
            side: anchor.side,
            lineNumber: anchor.lineNumber,
            metadata: { kind: "hunk", hunkIndex },
          })
        })
        result.set(file.name, arr)
      }
    }
    return result
  }, [comments, draft, files, onDiscardHunk])

  if (loading) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading diff…</div>
    )
  }
  if (error !== null) {
    return <div className="p-8 text-sm text-destructive">{error}</div>
  }
  if (files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-sm">
        <div className="font-medium">Nothing to review</div>
        <div className="text-muted-foreground">{emptyHint(target)}</div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="diff-pane h-full overflow-auto">
      {files.map((file) => (
        <FileDiffSection
          key={`${target.kind}-${file.prevName ?? ""}-${file.name}`}
          file={file}
          theme={theme}
          diffStyle={diffStyle}
          connectorsEnabled={connectorsEnabled}
          annotations={annotationsByFile.get(file.name) ?? []}
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
          onDiscardFile={onDiscardFile}
          onDiscardHunk={onDiscardHunk}
          onCommentSubmit={onCommentSubmit}
          onCommentDelete={onCommentDelete}
          onCommentReply={onCommentReply}
        />
      ))}
    </div>
  )
}
