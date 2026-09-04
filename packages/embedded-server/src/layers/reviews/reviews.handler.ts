import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import {
  GitProviderError,
  GitProvider,
} from "@byconvo/core/ports/git-provider";

const ok = { ok: true } as const;

/**
 * The request number out of the path. Every forge numbers what it opens —
 * GitHub's `#12`, GitLab's `!12` — and everything below is addressed by it.
 */
const pullNumber = (raw: string): Effect.Effect<number, GitProviderError> =>
  Number.isInteger(Number(raw))
    ? Effect.succeed(Number(raw))
    : Effect.fail(
        new GitProviderError({ reason: `invalid request number: ${raw}` })
      );

export const ReviewsHandler = HttpApiBuilder.group(Api, "reviews", (handlers) =>
  handlers
    .handle("pulls", () => Effect.flatMap(GitProvider, (s) => s.pulls))
    .handle("mergePull", ({ params, payload }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) =>
          Effect.flatMap(GitProvider, (s) => s.mergePull(n, payload.method))
        )
      )
    )
    .handle("closePull", ({ params }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) =>
          Effect.flatMap(GitProvider, (s) => s.closePull(n))
        )
      )
    )
    .handle("pullDiff", ({ params }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) => Effect.flatMap(GitProvider, (s) => s.pullDiff(n)))
      )
    )
    .handle("pullComments", ({ params }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) =>
          Effect.flatMap(GitProvider, (s) => s.pullComments(n))
        )
      )
    )
    .handle("createPullComment", ({ params, payload }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) =>
          Effect.flatMap(GitProvider, (s) =>
            s.createPullComment({
              pullNumber: n,
              filePath: payload.filePath,
              side: payload.side,
              lineNumber: payload.lineNumber,
              body: payload.body,
            })
          )
        )
      )
    )
    // The comment id stays a string the whole way down: it is the forge's own
    // name for the comment, and only that forge knows how to read it.
    .handle("deletePullComment", ({ params }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) =>
          Effect.flatMap(GitProvider, (s) =>
            s.deletePullComment({ pullNumber: n, commentId: params.commentId })
          )
        ),
        Effect.as(ok)
      )
    )
    .handle("replyPullComment", ({ params, payload }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) =>
          Effect.flatMap(GitProvider, (s) =>
            s.replyToPullComment({
              pullNumber: n,
              commentId: params.commentId,
              body: payload.body,
            })
          )
        )
      )
    )
);
