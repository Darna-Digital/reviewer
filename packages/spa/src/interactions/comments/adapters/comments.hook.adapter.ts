import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchClient } from "@/lib/api/client";
import type { ReviewComment } from "@byconvo/core/comments";
import { createCommentsFunctions } from "../functions/comments.functions";
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

  return {
    submit: async (
      ctx: SubmitContext,
      location: DraftLocation,
      body: string
    ) => {
      const created = await fns.submit(ctx, location, body);
      void invalidate(
        ctx.mode === "review"
          ? "/api/github/pulls/{number}/comments"
          : "/api/comments"
      );
      return created;
    },
    remove: async (comment: ReviewComment) => {
      const removed = await fns.remove(comment);
      if (removed) void invalidate("/api/comments");
      return removed;
    },
    update: async (comment: ReviewComment, body: string) => {
      const updated = await fns.update(comment, body);
      if (updated !== null) void invalidate("/api/comments");
      return updated;
    },
    reply: fns.reply,
  };
}
