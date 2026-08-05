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

/** One file's comments, in reading order. */
export interface CommentGroup {
  readonly filePath: string
  readonly comments: ReadonlyArray<ListedComment>
}

/**
 * The list as it reads: files in most-recently-commented order, and within a
 * file the comments top to bottom, the way you would meet them in the code.
 */
export const groupByFile = (
  comments: ReadonlyArray<ListedComment>
): Array<CommentGroup> => {
  const files = new Map<string, Array<ListedComment>>()
  for (const comment of comments) {
    const bucket = files.get(comment.code.filePath)
    if (bucket) bucket.push(comment)
    else files.set(comment.code.filePath, [comment])
  }
  return [...files].map(([filePath, list]) => ({
    filePath,
    comments: [...list].sort((a, b) => a.code.lineNumber - b.code.lineNumber),
  }))
}

/** A path split for display: the file's own name, and the folders above it. */
export const fileLabel = (
  filePath: string
): { readonly name: string; readonly dir: string } => {
  const cut = filePath.lastIndexOf("/")
  return cut === -1
    ? { name: filePath, dir: "" }
    : { name: filePath.slice(cut + 1), dir: filePath.slice(0, cut) }
}

/** What a comment's stored target is called on screen. */
export const targetLabel = (target: string): string => {
  if (target === "worktree") return "Working tree"
  if (target.startsWith("pr-")) return `PR #${target.slice("pr-".length)}`
  if (target.startsWith("commit-"))
    return target.slice("commit-".length, "commit-".length + 7)
  if (target.includes("...")) return target.replace("...", " → ")
  return target
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
