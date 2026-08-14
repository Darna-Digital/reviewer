import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { api, fetchClient } from "@/lib/api/client";
import type { ReviewComment } from "@byconvo/core/comments";
import { createCommentsFunctions } from "../functions/comments.functions";
import {
  optimisticComment,
  optimisticId,
  withComment,
  withConfirmed,
  withEditedBody,
  withoutComment,
} from "../functions/optimistic-comments.functions";
import type {
  CommentsFunctions,
  DraftLocation,
  SubmitContext,
} from "../interfaces/comments.interfaces";

/** Wires the real API mutations + TanStack Query cache into the comment logic. */
export function useCommentsActions() {
  const queryClient = useQueryClient();

  const fns: CommentsFunctions = useMemo(
    () =>
      createCommentsFunctions({
        data: {},
        sideEffects: {
          addLocalComment: async (input) => {
            const { data, error } = await fetchClient.POST("/api/comments", {
              body: input,
            });
            if (error)
              throw new Error(
                (error as { reason?: string }).reason ?? "failed to comment"
              );
            return data;
          },
          addPullComment: async (pullNumber, input) => {
            const { data, error } = await fetchClient.POST(
              "/api/github/pulls/{number}/comments",
              {
                params: { path: { number: String(pullNumber) } },
                body: input,
              }
            );
            if (error)
              throw new Error(
                (error as { reason?: string }).reason ?? "failed to comment"
              );
            return data;
          },
          updateLocalComment: async (id, body) => {
            const { data, error } = await fetchClient.PATCH(
              "/api/comments/{id}",
              {
                params: { path: { id } },
                body: { body },
              }
            );
            if (error)
              throw new Error(
                (error as { reason?: string }).reason ?? "failed to update"
              );
            return data;
          },
          deleteComment: async (id) => {
            await fetchClient.DELETE("/api/comments/{id}", {
              params: { path: { id } },
            });
          },
          replyPullComment: async (pullNumber, commentId, body) => {
            const { data, error } = await fetchClient.POST(
              "/api/github/pulls/{number}/comments/{commentId}/replies",
              {
                params: {
                  path: {
                    number: String(pullNumber),
                    commentId: String(commentId),
                  },
                },
                body: { body },
              }
            );
            if (error)
              throw new Error(
                (error as { reason?: string }).reason ?? "failed to reply"
              );
            return data;
          },
        },
      }),
    []
  );

  const invalidate = (key: string) =>
    queryClient.invalidateQueries({ queryKey: ["get", key] });

  // The canonical key the `useComments` hook reads under, taken from the client
  // rather than written out here — a hand-built key that drifts from it would
  // fail silently, as an optimistic edit that simply never appears.
  const localCommentsKey = api.queryOptions(
    "get",
    "/api/comments",
    {}
  ).queryKey;

  type Comments = ReadonlyArray<ReviewComment>;

  /** Edit the list on screen now. Returns the list as it was, to put back. */
  const editLocal = (change: (list: Comments) => Comments): Comments => {
    const before = queryClient.getQueryData<Comments>(localCommentsKey) ?? [];
    queryClient.setQueryData<Comments>(localCommentsKey, change(before));
    return before;
  };

  const restore = (before: Comments) =>
    queryClient.setQueryData<Comments>(localCommentsKey, before);

  /**
   * A refetch already in flight would land after the optimistic edit and undo
   * it, so it is cancelled first. Not awaited: waiting on it would put the
   * round-trip back in front of the comment appearing, which is the entire
   * thing being removed here.
   */
  const holdRefetches = () =>
    void queryClient.cancelQueries({ queryKey: localCommentsKey });

  // Only has to be unique within this session — it never reaches the server.
  const pending = useRef(0);

  return {
    submit: async (
      ctx: SubmitContext,
      location: DraftLocation,
      body: string
    ) => {
      // A pull request comment is a write to GitHub: slow, fallible, and named
      // by them. It stays as it was — asked for, then waited on.
      if (ctx.mode === "review" && ctx.selectedPull !== null) {
        const created = await fns.submit(ctx, location, body);
        void invalidate("/api/github/pulls/{number}/comments");
        return created;
      }

      pending.current += 1;
      const placeholder = optimisticComment({
        id: optimisticId(pending.current),
        filePath: location.filePath,
        side: location.side,
        lineNumber: location.lineNumber,
        body,
        target: ctx.targetKey,
        // Filled in by the server; shown for the moment before it answers.
        author: "you",
        createdAt: new Date().toISOString(),
      });
      holdRefetches();
      const before = editLocal((list) => withComment(list, placeholder));
      try {
        const created = await fns.submit(ctx, location, body);
        editLocal((list) => withConfirmed(list, placeholder.id, created));
        return created;
      } catch (error) {
        // Put it back, then reconcile: concurrent edits (assigning a review
        // removes every comment at once) can interleave, and only the server
        // knows what actually survived.
        restore(before);
        void invalidate("/api/comments");
        throw error;
      }
    },

    remove: async (comment: ReviewComment) => {
      if (comment.source !== "local") return fns.remove(comment);
      holdRefetches();
      const before = editLocal((list) => withoutComment(list, comment.id));
      try {
        const removed = await fns.remove(comment);
        void invalidate("/api/comments");
        return removed;
      } catch (error) {
        // Put it back, then reconcile: concurrent edits (assigning a review
        // removes every comment at once) can interleave, and only the server
        // knows what actually survived.
        restore(before);
        void invalidate("/api/comments");
        throw error;
      }
    },

    update: async (comment: ReviewComment, body: string) => {
      if (comment.source !== "local") return fns.update(comment, body);
      holdRefetches();
      const before = editLocal((list) =>
        withEditedBody(list, comment.id, body)
      );
      try {
        const updated = await fns.update(comment, body);
        if (updated !== null) {
          editLocal((list) => withConfirmed(list, comment.id, updated));
        }
        return updated;
      } catch (error) {
        // Put it back, then reconcile: concurrent edits (assigning a review
        // removes every comment at once) can interleave, and only the server
        // knows what actually survived.
        restore(before);
        void invalidate("/api/comments");
        throw error;
      }
    },

    reply: fns.reply,
  };
}
