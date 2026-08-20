/**
 * GitHub-backed PR repository — the real implementation. Ports `core/GitHub.ts`
 * onto the shared `GitHubClient` (owner/repo resolution + REST helpers).
 */
import * as Effect from "effect/Effect";
import { GitProviderError } from "@byconvo/core/ports/git-provider";
import { GitHubClient } from "./github-client.ts";
import { diffFromPullFiles, parsePullFiles } from "./pull-files-diff.ts";
import type { PullFileEntry } from "./pull-files-diff.ts";
import {
  PULLS_PER_PAGE,
  PULLS_QUERY,
  pullFromRest,
  pullsFromGraphql,
} from "./pull-request-mapping.ts";
import type { ReviewComment } from "@byconvo/core/comments";
import type {
  PullRequestInfo,
  GitProviderShape,
} from "@byconvo/core/ports/git-provider";

const FILES_PER_PAGE = 100;
const MAX_FILE_PAGES = 30;

const isDiffTooLarge = (error: GitProviderError): boolean =>
  error.status === 406;

export const makeGitHubProvider = Effect.gen(function* () {
  const gh = yield* GitHubClient;

  /**
   * The plain listing. Always available — it is the one call that works without
   * a token on a public repo — but it knows nothing about CI or conflicts.
   */
  const restPulls = Effect.gen(function* () {
    const { owner, repo } = yield* gh.repo;
    const data = yield* gh.getJson(
      `/repos/${owner}/${repo}/pulls?state=open&per_page=${PULLS_PER_PAGE}`
    );
    if (!Array.isArray(data)) return [];
    return (data as Array<Record<string, unknown>>).map((pr): PullRequestInfo =>
      pullFromRest(pr)
    );
  });

  /**
   * Every open pull request with the parts the review pane decides by — CI on
   * the head commit, whether it merges cleanly, who is on it — in one request.
   *
   * GraphQL is asked first and the listing is the fallback rather than the
   * other way around, because the fallback is the lesser answer: a list that
   * cannot say a pull request is blocked is still a usable list, and one that
   * fails because there is no token is not.
   */
  const pulls: GitProviderShape["pulls"] = Effect.gen(function* () {
    const { owner, repo } = yield* gh.repo;
    return yield* gh
      .graphql(PULLS_QUERY, { owner, repo, first: PULLS_PER_PAGE })
      .pipe(
        Effect.map(pullsFromGraphql),
        Effect.catch((error) =>
          Effect.gen(function* () {
            yield* Effect.logInfo(
              `GitHub GraphQL is unavailable (${error.reason}); ` +
                "listing pull requests over REST without CI or merge status."
            );
            return yield* restPulls;
          })
        )
      );
  });

  const pullFiles = (owner: string, repo: string, pullNumber: number) =>
    Effect.gen(function* () {
      const entries: Array<PullFileEntry> = [];
      for (let page = 1; page <= MAX_FILE_PAGES; page++) {
        const data = yield* gh.getJson(
          `/repos/${owner}/${repo}/pulls/${pullNumber}/files` +
            `?per_page=${FILES_PER_PAGE}&page=${page}`
        );
        const parsed = parsePullFiles(data);
        entries.push(...parsed);
        if (parsed.length < FILES_PER_PAGE) return entries;
      }
      yield* Effect.logWarning(
        `PR #${pullNumber}: stopped after ${MAX_FILE_PAGES} pages of files ` +
          `(${entries.length} files); the diff shown is incomplete.`
      );
      return entries;
    });

  const pullDiff: GitProviderShape["pullDiff"] = (pullNumber) =>
    Effect.gen(function* () {
      const { owner, repo } = yield* gh.repo;
      return yield* gh
        .getText(
          `/repos/${owner}/${repo}/pulls/${pullNumber}`,
          "application/vnd.github.v3.diff"
        )
        .pipe(
          Effect.catchIf(isDiffTooLarge, (error) =>
            Effect.gen(function* () {
              yield* Effect.logInfo(
                `PR #${pullNumber}: ${error.reason}; rebuilding the diff from paginated file patches.`
              );
              const files = yield* pullFiles(owner, repo, pullNumber);
              return diffFromPullFiles(files);
            })
          )
        );
    });

  const pullComments: GitProviderShape["pullComments"] = (pullNumber) =>
    Effect.gen(function* () {
      const { owner, repo } = yield* gh.repo;
      const data = (yield* gh.getJson(
        `/repos/${owner}/${repo}/pulls/${pullNumber}/comments?per_page=100`
      )) as any;
      if (!Array.isArray(data)) return [];
      return data.flatMap((comment: any): Array<ReviewComment> => {
        if (
          typeof comment.line !== "number" ||
          typeof comment.path !== "string"
        )
          return [];
        return [
          {
            id: `gh-${comment.id}`,
            filePath: comment.path,
            side: comment.side === "LEFT" ? "deletions" : "additions",
            lineNumber: comment.line,
            body: comment.body ?? "",
            author: comment.user?.login ?? "",
            createdAt: comment.created_at ?? "",
            target: `pr-${pullNumber}`,
            source: "github",
          },
        ];
      });
    });

  const createPullComment: GitProviderShape["createPullComment"] = (input) =>
    Effect.gen(function* () {
      const { owner, repo } = yield* gh.repo;
      const prData = (yield* gh.getJson(
        `/repos/${owner}/${repo}/pulls/${input.pullNumber}`
      )) as any;
      const headSha = prData?.head?.sha;
      if (typeof headSha !== "string") {
        return yield* Effect.fail(
          new GitProviderError({ reason: "could not resolve PR head sha" })
        );
      }
      const created = (yield* gh.postJson(
        `/repos/${owner}/${repo}/pulls/${input.pullNumber}/comments`,
        {
          body: input.body,
          commit_id: headSha,
          path: input.filePath,
          line: input.lineNumber,
          side: input.side === "deletions" ? "LEFT" : "RIGHT",
        }
      )) as any;
      return {
        id: `gh-${created.id}`,
        filePath: input.filePath,
        side: input.side,
        lineNumber: input.lineNumber,
        body: input.body,
        author: created.user?.login ?? "",
        createdAt: created.created_at ?? new Date().toISOString(),
        target: `pr-${input.pullNumber}`,
        source: "github",
      } satisfies ReviewComment;
    });

  const replyToPullComment: GitProviderShape["replyToPullComment"] = (input) =>
    Effect.gen(function* () {
      const { owner, repo } = yield* gh.repo;
      const created = (yield* gh.postJson(
        `/repos/${owner}/${repo}/pulls/${input.pullNumber}/comments/${input.commentId}/replies`,
        { body: input.body }
      )) as any;
      return {
        id: `gh-${created.id}`,
        filePath: created.path ?? "",
        side: created.side === "LEFT" ? "deletions" : "additions",
        lineNumber: typeof created.line === "number" ? created.line : 0,
        body: created.body ?? input.body,
        author: created.user?.login ?? "",
        createdAt: created.created_at ?? new Date().toISOString(),
        target: `pr-${input.pullNumber}`,
        source: "github",
      } satisfies ReviewComment;
    });

  return {
    pulls,
    pullDiff,
    pullComments,
    createPullComment,
    replyToPullComment,
  } satisfies GitProviderShape;
});
