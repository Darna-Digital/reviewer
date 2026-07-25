import { dateCutoff, type DateFilter } from "@/lib/date-filter"
import type { ReviewComment } from "@byconvo/core/comments"
import type { VisualComment } from "@byconvo/core/visual-comments"

export type CommentKind = "visual" | "code"

export const KIND_FILTERS = [
  { value: "all", label: "All comments" },
  { value: "visual", label: "Visual" },
  { value: "code", label: "Code" },
] as const

export type KindFilter = (typeof KIND_FILTERS)[number]["value"]

export interface UnifiedComment {
  readonly id: string
  readonly kind: CommentKind
  readonly body: string
  readonly author: string
  readonly createdAt: string
  readonly anchor: string
  readonly context: string
  readonly code?: ReviewComment
  readonly visual?: VisualComment
}

export const fromCode = (comment: ReviewComment): UnifiedComment => ({
  id: comment.id,
  kind: "code",
  body: comment.body,
  author: comment.author,
  createdAt: comment.createdAt,
  anchor: `${comment.filePath}:${comment.lineNumber}`,
  context: comment.target,
  code: comment,
})

export const fromVisual = (comment: VisualComment): UnifiedComment => ({
  id: comment.id,
  kind: "visual",
  body: comment.body,
  author: comment.author,
  createdAt: comment.createdAt,
  anchor: comment.label,
  context: comment.route,
  visual: comment,
})

export interface ListFilters {
  readonly kind: KindFilter
  readonly date: DateFilter
  readonly search: string
}

export const noFilters: ListFilters = { kind: "all", date: "all", search: "" }

export const filtersActive = (filters: ListFilters) =>
  filters.kind !== "all" ||
  filters.date !== "all" ||
  filters.search.trim().length > 0

export const unify = (
  code: ReadonlyArray<ReviewComment>,
  visual: ReadonlyArray<VisualComment>
): Array<UnifiedComment> =>
  [
    ...code.filter((c) => c.source === "local").map(fromCode),
    ...visual.map(fromVisual),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export const applyFilters = (
  comments: ReadonlyArray<UnifiedComment>,
  filters: ListFilters
): Array<UnifiedComment> => {
  const cutoff = dateCutoff(filters.date)
  const query = filters.search.trim().toLowerCase()
  return comments.filter((comment) => {
    if (filters.kind !== "all" && comment.kind !== filters.kind) return false
    if (cutoff > 0 && Date.parse(comment.createdAt) < cutoff) return false
    if (query.length > 0) {
      const haystack =
        `${comment.body}\n${comment.anchor}\n${comment.context}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

export interface CommentGroup {
  readonly kind: CommentKind
  readonly comments: Array<UnifiedComment>
}

export const groupByKind = (
  comments: ReadonlyArray<UnifiedComment>
): Array<CommentGroup> =>
  (["visual", "code"] as const)
    .map((kind) => ({
      kind,
      comments: comments.filter((c) => c.kind === kind),
    }))
    .filter((group) => group.comments.length > 0)
