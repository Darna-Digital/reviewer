import type { WorkspaceComment } from "../schema/workspace-comments.schema.ts"

export interface CommentNode {
  readonly comment: WorkspaceComment
  readonly replies: ReadonlyArray<CommentNode>
}

const byOldestFirst = (a: WorkspaceComment, b: WorkspaceComment): number =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)

export const sortComments = (
  comments: ReadonlyArray<WorkspaceComment>
): ReadonlyArray<WorkspaceComment> => [...comments].sort(byOldestFirst)

/**
 * Nest replies under the comment they answer, oldest first at every level. A
 * reply whose parent is missing (deleted, or filtered out) is promoted to the
 * top of the thread rather than dropped — a thread must not lose messages.
 */
export const buildCommentTree = (
  comments: ReadonlyArray<WorkspaceComment>
): ReadonlyArray<CommentNode> => {
  const present = new Set(comments.map((c) => c.id))
  const repliesTo = new Map<string, Array<WorkspaceComment>>()
  const roots: Array<WorkspaceComment> = []

  for (const comment of comments) {
    const parentId = comment.parentId
    if (parentId !== null && present.has(parentId)) {
      const siblings = repliesTo.get(parentId)
      if (siblings === undefined) repliesTo.set(parentId, [comment])
      else siblings.push(comment)
    } else {
      roots.push(comment)
    }
  }

  const build = (comment: WorkspaceComment): CommentNode => ({
    comment,
    replies: sortComments(repliesTo.get(comment.id) ?? []).map(build),
  })

  return sortComments(roots).map(build)
}

/** Every reply beneath a comment, however deeply nested. */
export const countReplies = (node: CommentNode): number =>
  node.replies.reduce((total, reply) => total + 1 + countReplies(reply), 0)

/** A comment body is only worth posting once its whitespace is gone. */
export const normalizeCommentBody = (body: string): string => body.trim()

/**
 * Group a flat list by the subject it belongs to, so one fetch can hydrate the
 * comment counts of a whole issue list.
 */
export const countBySubject = (
  comments: ReadonlyArray<WorkspaceComment>
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>()
  for (const comment of comments) {
    counts.set(comment.subjectId, (counts.get(comment.subjectId) ?? 0) + 1)
  }
  return counts
}
