/**
 * The comment thread on a task or a doc, over its TanStack DB collection.
 *
 * Posting is optimistic: the comment appears with the signed-in user's own
 * name the moment it is sent, because the alternative — a round trip before
 * anything shows — reads as a dropped keystroke. The server's row replaces the
 * local one on the next refetch.
 */
import { useLiveQuery } from "@tanstack/react-db"
import { useCallback, useMemo } from "react"
import { toast } from "sonner"
import { buildCommentTree } from "@byconvo/core/workspace-comments"
import type {
  CommentSubject,
  WorkspaceComment,
} from "@byconvo/core/workspace-comments"
import { canDeleteComment, canEditComment } from "@byconvo/core/identity"
import type { MemberRole } from "@byconvo/core/identity"
import { useSession } from "@/lib/central/auth-client"
import { commentsCollection } from "@/lib/central/collections"

const report = (error: unknown, fallback: string) => {
  toast.error(error instanceof Error ? error.message : fallback)
}

export function useCommentThread(
  subjectType: CommentSubject,
  subjectId: string | null,
  role: MemberRole | null
) {
  // A collection needs a subject; an unopened pane passes null, and the
  // placeholder key keeps the hook order stable until one is chosen.
  const collection = commentsCollection(subjectType, subjectId ?? "none")
  const { data, isLoading } = useLiveQuery(
    (q) => q.from({ comment: collection }),
    [subjectType, subjectId]
  )
  const session = useSession()
  const userId = session.data?.user.id ?? null

  const comments = useMemo(
    () => (data ?? []) as ReadonlyArray<WorkspaceComment>,
    [data]
  )
  const tree = useMemo(() => buildCommentTree(comments), [comments])

  const post = useCallback(
    async (body: string, parentId: string | null = null) => {
      const trimmed = body.trim()
      if (trimmed.length === 0 || subjectId === null || userId === null) {
        return false
      }
      try {
        collection.insert({
          id: `pending-${crypto.randomUUID()}`,
          subjectType,
          subjectId,
          parentId,
          body: trimmed,
          author: {
            id: userId,
            name: session.data?.user.name ?? "You",
            email: session.data?.user.email ?? "",
            image: session.data?.user.image ?? null,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          edited: false,
        })
        return true
      } catch (error) {
        report(error, "could not post the comment")
        return false
      }
    },
    [collection, subjectType, subjectId, userId, session.data]
  )

  const edit = useCallback(
    (id: string, body: string) => {
      const trimmed = body.trim()
      if (trimmed.length === 0) return
      try {
        collection.update(id, (draft) => {
          draft.body = trimmed
          draft.edited = true
        })
      } catch (error) {
        report(error, "could not save the comment")
      }
    },
    [collection]
  )

  const remove = useCallback(
    (id: string) => {
      try {
        collection.delete(id)
      } catch (error) {
        report(error, "could not delete the comment")
      }
    },
    [collection]
  )

  return {
    tree,
    count: comments.length,
    isLoading,
    post,
    edit,
    remove,
    /** Whether the signed-in member may edit or delete a given comment. */
    canEdit: (comment: WorkspaceComment) =>
      userId !== null && canEditComment(comment.author.id, userId),
    canDelete: (comment: WorkspaceComment) =>
      userId !== null &&
      role !== null &&
      canDeleteComment(role, comment.author.id, userId),
  }
}
