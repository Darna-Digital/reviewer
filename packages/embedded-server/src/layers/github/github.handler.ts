import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import {
  GitProviderError,
  GitProvider,
} from "@reviewer/core/ports/git-provider";
import { GitHubLogin } from "./github-login.ts";

const ok = { ok: true } as const;

const pullNumber = (raw: string): Effect.Effect<number, GitProviderError> =>
  Number.isInteger(Number(raw))
    ? Effect.succeed(Number(raw))
    : Effect.fail(
        new GitProviderError({ reason: `invalid PR number: ${raw}` })
      );

export const GitHubHandler = HttpApiBuilder.group(Api, "github", (handlers) =>
  handlers
    .handle("auth", () => Effect.flatMap(GitProvider, (s) => s.auth))
    .handle("startLogin", () => Effect.flatMap(GitHubLogin, (s) => s.start))
    .handle("loginStatus", () => Effect.flatMap(GitHubLogin, (s) => s.status))
    .handle("cancelLogin", () => Effect.flatMap(GitHubLogin, (s) => s.cancel))
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
    .handle("deletePullComment", ({ params }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) =>
          pullNumber(params.commentId).pipe(
            Effect.flatMap((commentId) =>
              Effect.flatMap(GitProvider, (s) =>
                s.deletePullComment({ pullNumber: n, commentId })
              )
            )
          )
        ),
        Effect.as(ok)
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
