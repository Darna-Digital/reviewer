import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { api, fetchClient } from "@/lib/api/client";
import type { ReviewComment } from "@reviewer/core/comments";
import { createCommentsFunctions } from "../functions/comments.functions";
import {
  optimisticComment,
  optimisticId,
  optimisticPullComment,
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
          deletePullComment: async (pullNumber, commentId) => {
            const { error } = await fetchClient.DELETE(
              "/api/github/pulls/{number}/comments/{commentId}",
              {
                params: {
                  path: {
                    number: String(pullNumber),
                    commentId: String(commentId),
                  },
                },
              }
            );
            if (error)
              throw new Error(
                (error as { reason?: string }).reason ?? "failed to delete"
              );
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

  /** The same, for one pull request's comments — keyed by its number. */
  const pullCommentsKey = (pullNumber: number) =>
    api.queryOptions("get", "/api/github/pulls/{number}/comments", {
      params: { path: { number: String(pullNumber) } },
    }).queryKey;

  type Comments = ReadonlyArray<ReviewComment>;
  type CacheKey = ReturnType<typeof pullCommentsKey> | typeof localCommentsKey;

  /** Edit a list on screen now. Returns the list as it was, to put back. */
  const edit = (
    key: CacheKey,
    change: (list: Comments) => Comments
  ): Comments => {
    const before = queryClient.getQueryData<Comments>(key) ?? [];
    queryClient.setQueryData<Comments>(key, change(before));
    return before;
  };

  const restore = (key: CacheKey, before: Comments) =>
    queryClient.setQueryData<Comments>(key, before);

  /**
   * A refetch already in flight would land after the optimistic edit and undo
   * it, so it is cancelled first. Not awaited: waiting on it would put the
   * round-trip back in front of the comment appearing, which is the entire
   * thing being removed here.
   */
  const holdRefetches = (key: CacheKey) =>
    void queryClient.cancelQueries({ queryKey: key });

  // Only has to be unique within this session — it never reaches the server.
  const pending = useRef(0);

  return {
    submit: async (
      ctx: SubmitContext,
      location: DraftLocation,
      body: string
    ) => {
      pending.current += 1;
      const id = optimisticId(pending.current);
      const createdAt = new Date().toISOString();

      // A pull request comment goes to GitHub rather than to disk. It still
      // appears at once — waiting on somebody else's server is the thing being
      // removed — but it is marked unacknowledged until GitHub confirms it,
      // because unlike a local write this one can genuinely fail.
      const pull = ctx.mode === "review" ? ctx.selectedPull : null;
      const key =
        pull === null ? localCommentsKey : pullCommentsKey(pull.number);
      const placeholder =
        pull === null
          ? optimisticComment({
              id,
              filePath: location.filePath,
              side: location.side,
              lineNumber: location.lineNumber,
              body,
              target: ctx.targetKey,
              // Filled in by the server; shown for the moment before it answers.
              author: "you",
              createdAt,
            })
          : optimisticPullComment({
              id,
              filePath: location.filePath,
              side: location.side,
              lineNumber: location.lineNumber,
              body,
              pullNumber: pull.number,
              createdAt,
            });

      holdRefetches(key);
      const before = edit(key, (list) => withComment(list, placeholder));
      try {
        const created = await fns.submit(ctx, location, body);
        edit(key, (list) => withConfirmed(list, id, created));
        return created;
      } catch (error) {
        // Put it back, then reconcile: concurrent edits (assigning a review
        // removes every comment at once) can interleave, and only the server
        // knows what actually survived.
        restore(key, before);
        void invalidate(
          pull === null
            ? "/api/comments"
            : "/api/github/pulls/{number}/comments"
        );
        throw error;
      }
    },

    remove: async (
      selectedPull: SubmitContext["selectedPull"],
      comment: ReviewComment
    ) => {
      // A GitHub comment is removed from the list its pull request is keyed
      // under, a local one from the working tree's list. With no pull request in
      // hand there is nothing to delete a GitHub comment from, so the logic
      // answers for it rather than a list being edited on a guess.
      const pull = comment.source === "github" ? selectedPull : null;
      if (comment.source === "github" && pull === null)
        return fns.remove(selectedPull, comment);
      const key =
        pull === null ? localCommentsKey : pullCommentsKey(pull.number);
      const path =
        pull === null ? "/api/comments" : "/api/github/pulls/{number}/comments";
      holdRefetches(key);
      const before = edit(key, (list) => withoutComment(list, comment.id));
      try {
        const removed = await fns.remove(selectedPull, comment);
        void invalidate(path);
        return removed;
      } catch (error) {
        // Put it back, then reconcile: concurrent edits (assigning a review
        // removes every comment at once) can interleave, and only the server
        // knows what actually survived.
        restore(key, before);
        void invalidate(path);
        throw error;
      }
    },

    update: async (comment: ReviewComment, body: string) => {
      if (comment.source !== "local") return fns.update(comment, body);
      holdRefetches(localCommentsKey);
      const before = edit(localCommentsKey, (list) =>
        withEditedBody(list, comment.id, body)
      );
      try {
        const updated = await fns.update(comment, body);
        if (updated !== null) {
          edit(localCommentsKey, (list) =>
            withConfirmed(list, comment.id, updated)
          );
        }
        return updated;
      } catch (error) {
        // Put it back, then reconcile: concurrent edits (assigning a review
        // removes every comment at once) can interleave, and only the server
        // knows what actually survived.
        restore(localCommentsKey, before);
        void invalidate("/api/comments");
        throw error;
      }
    },

    /**
     * A reply is the same bargain as a new pull comment: shown at once,
     * anchored to the line its parent sits on so it joins that thread rather
     * than opening one of its own, and marked unacknowledged until GitHub
     * names it.
     */
    reply: async (
      selectedPull: SubmitContext["selectedPull"],
      comment: ReviewComment,
      body: string
    ) => {
      if (selectedPull === null || comment.source !== "github") {
        return fns.reply(selectedPull, comment, body);
      }
      pending.current += 1;
      const key = pullCommentsKey(selectedPull.number);
      const placeholder = optimisticPullComment({
        id: optimisticId(pending.current),
        filePath: comment.filePath,
        side: comment.side,
        lineNumber: comment.lineNumber,
        body,
        pullNumber: selectedPull.number,
        createdAt: new Date().toISOString(),
      });
      holdRefetches(key);
      const before = edit(key, (list) => withComment(list, placeholder));
      try {
        const created = await fns.reply(selectedPull, comment, body);
        // `reply` answers null when it cannot identify the parent; there is
        // then nothing to confirm, so the placeholder comes back out.
        edit(key, (list) =>
          created === null
            ? withoutComment(list, placeholder.id)
            : withConfirmed(list, placeholder.id, created)
        );
        return created;
      } catch (error) {
        restore(key, before);
        void invalidate("/api/github/pulls/{number}/comments");
        throw error;
      }
    },
  };
}
