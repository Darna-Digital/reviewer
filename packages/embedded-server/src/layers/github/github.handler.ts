import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/http-api";
import { Api } from "../../api.ts";
import {
  GitProviderError,
  GitProvider,
} from "@reviewer/core/ports/git-provider";
import { GitHubLogin } from "./github-login.ts";
import { withGitHubOf } from "./github.scope.ts";

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
    .handle("pulls", ({ query }) => withGitHubOf(query.repo)((s) => s.pulls))
    .handle("mergePull", ({ params, query, payload }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) =>
          withGitHubOf(query.repo)((s) => s.mergePull(n, payload.method))
        )
      )
    )
    .handle("closePull", ({ params, query }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) => withGitHubOf(query.repo)((s) => s.closePull(n)))
      )
    )
    .handle("pullDiff", ({ params, query }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) => withGitHubOf(query.repo)((s) => s.pullDiff(n)))
      )
    )
    .handle("pullComments", ({ params, query }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) =>
          withGitHubOf(query.repo)((s) => s.pullComments(n))
        )
      )
    )
    .handle("createPullComment", ({ params, query, payload }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) =>
          withGitHubOf(query.repo)((s) =>
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
    .handle("updatePullComment", ({ params, query, payload }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) =>
          pullNumber(params.commentId).pipe(
            Effect.flatMap((commentId) =>
              withGitHubOf(query.repo)((s) =>
                s.updatePullComment({
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
    .handle("deletePullComment", ({ params, query }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) =>
          pullNumber(params.commentId).pipe(
            Effect.flatMap((commentId) =>
              withGitHubOf(query.repo)((s) =>
                s.deletePullComment({ pullNumber: n, commentId })
              )
            )
          )
        ),
        Effect.as(ok)
      )
    )
    .handle("replyPullComment", ({ params, query, payload }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap((n) =>
          pullNumber(params.commentId).pipe(
            Effect.flatMap((commentId) =>
              withGitHubOf(query.repo)((s) =>
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
    .handle("setPullThreadResolved", ({ params, query, payload }) =>
      pullNumber(params.number).pipe(
        Effect.flatMap(() =>
          withGitHubOf(query.repo)((s) =>
            s.setThreadResolved({
              threadId: params.threadId,
              resolved: payload.resolved,
            })
          )
        ),
        Effect.as(ok)
      )
    )
);
