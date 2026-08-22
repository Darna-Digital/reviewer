import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import {
  GitProviderError,
  GitProvider,
} from "@byconvo/core/ports/git-provider";

const pullNumber = (raw: string): Effect.Effect<number, GitProviderError> =>
  Number.isInteger(Number(raw))
    ? Effect.succeed(Number(raw))
    : Effect.fail(
        new GitProviderError({ reason: `invalid PR number: ${raw}` })
      );

export const GitHubHandler = HttpApiBuilder.group(Api, "github", (handlers) =>
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
    .handle("replyPullComment", ({ params, payload }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) =>
          pullNumber(params.commentId).pipe(
            Effect.flatMap((commentId) =>
              Effect.flatMap(GitProvider, (s) =>
                s.replyToPullComment({
                  pullNumber: n,
                  commentId,
                  body: payload.body,
                })
              )
            )
          )
        )
      )
    )
);
