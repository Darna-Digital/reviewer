import { dateCutoff, type DateFilter } from "@/lib/date-filter"
import type { ReviewComment } from "@byconvo/core/comments"

export interface ListedComment {
  readonly id: string
  readonly body: string
  readonly author: string
  readonly createdAt: string
  readonly anchor: string
  readonly context: string
  readonly code: ReviewComment
}

export const fromCode = (comment: ReviewComment): ListedComment => ({
  id: comment.id,
  body: comment.body,
  author: comment.author,
  createdAt: comment.createdAt,
  anchor: `${comment.filePath}:${comment.lineNumber}`,
  context: comment.target,
  code: comment,
})

export interface ListFilters {
  readonly date: DateFilter
  readonly search: string
}

export const noFilters: ListFilters = { date: "all", search: "" }

export const filtersActive = (filters: ListFilters) =>
  filters.date !== "all" || filters.search.trim().length > 0

export const listComments = (
  code: ReadonlyArray<ReviewComment>
): Array<ListedComment> =>
  code
    .filter((c) => c.source === "local")
    .map(fromCode)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export const applyFilters = (
  comments: ReadonlyArray<ListedComment>,
  filters: ListFilters
): Array<ListedComment> => {
  const cutoff = dateCutoff(filters.date)
  const query = filters.search.trim().toLowerCase()
  return comments.filter((comment) => {
    if (cutoff > 0 && Date.parse(comment.createdAt) < cutoff) return false
    if (query.length > 0) {
      const haystack =
        `${comment.body}\n${comment.anchor}\n${comment.context}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

const codeBlock = (comment: ReviewComment) =>
  `${comment.filePath}:${comment.lineNumber} - ${comment.body}`

export const buildAssignmentPrompt = (
  comments: ReadonlyArray<ListedComment>
): string =>
  `Address these review comments in the codebase:\n\n${comments
    .map((comment) => codeBlock(comment.code))
    .join("\n\n")}`

export const buildAssignmentTitle = (count: number): string =>
  `Fix ${count} review comment${count === 1 ? "" : "s"}`
