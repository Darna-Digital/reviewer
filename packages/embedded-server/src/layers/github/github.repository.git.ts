/**
 * GitHub-backed PR repository — the real implementation. Ports `core/GitHub.ts`
 * onto the shared `GitHubClient` (owner/repo resolution + REST helpers).
 */
import * as Effect from "effect/Effect";
import { GitProviderError } from "@reviewer/core/ports/git-provider";
import { GitHubClient } from "./github-client.ts";
import { diffFromPullFiles, parsePullFiles } from "./pull-files-diff.ts";
import type { PullFileEntry } from "./pull-files-diff.ts";
import {
  PULLS_PER_PAGE,
  PULLS_QUERY,
  pullFromRest,
  pullsFromGraphql,
} from "./pull-request-mapping.ts";
import type { ReviewComment } from "@reviewer/core/comments";
import type {
  PullRequestInfo,
  GitProviderShape,
} from "@reviewer/core/ports/git-provider";

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

  /**
   * Remove one review comment from the pull request.
   *
   * GitHub keys a review comment to the repository rather than to the pull
   * request it hangs on, so the number the caller was looking at plays no part
   * in the call — only in which list the answer belongs to. A comment somebody
   * else wrote comes back 403, which reaches the reviewer as GitHub's own
   * sentence about it rather than as a silent no-op.
   */
  const deletePullComment: GitProviderShape["deletePullComment"] = (input) =>
    Effect.gen(function* () {
      const { owner, repo } = yield* gh.repo;
      yield* gh.deleteResource(
        `/repos/${owner}/${repo}/pulls/comments/${input.commentId}`
      );
    });

  /**
   * Land the pull request on its base branch.
   *
   * GitHub answers a refusal with 405 (not mergeable — conflicts, a draft, a
   * failing required check, a protection rule) or 409 (the head moved since
   * the sha the caller was looking at). Both come back through `GitProviderError`
   * carrying GitHub's own sentence, which says which of those it was far better
   * than any wording of ours would.
   */
  const mergePull: GitProviderShape["mergePull"] = (pullNumber, method) =>
    Effect.gen(function* () {
      const { owner, repo } = yield* gh.repo;
      const merged = (yield* gh.putJson(
        `/repos/${owner}/${repo}/pulls/${pullNumber}/merge`,
        { merge_method: method }
      )) as { sha?: unknown; message?: unknown };
      return {
        sha: typeof merged.sha === "string" ? merged.sha : "",
        message:
          typeof merged.message === "string" && merged.message.length > 0
            ? merged.message
            : `Merged #${pullNumber}`,
      };
    });

  /**
   * Close the pull request without merging it.
   *
   * GitHub answers with the pull request itself rather than with a verdict, so
   * the answer is the state it comes back in — anything but `closed` means the
   * call did not do what was asked (a merged pull request cannot be closed),
   * and that is a failure rather than a success with a caveat in it.
   */
  const closePull: GitProviderShape["closePull"] = (pullNumber) =>
    Effect.gen(function* () {
      const { owner, repo } = yield* gh.repo;
      const closed = (yield* gh.patchJson(
        `/repos/${owner}/${repo}/pulls/${pullNumber}`,
        { state: "closed" }
      )) as { state?: unknown; merged?: unknown };
      const state =
        closed.merged === true
          ? "merged"
          : typeof closed.state === "string"
            ? closed.state
            : "unknown";
      return state === "closed"
        ? { message: `Closed #${pullNumber}` }
        : yield* Effect.fail(
            new GitProviderError({
              reason: `GitHub left #${pullNumber} ${state}`,
            })
          );
    });

  return {
    pulls,
    mergePull,
    closePull,
    pullDiff,
    pullComments,
    createPullComment,
    replyToPullComment,
    deletePullComment,
  } satisfies GitProviderShape;
});
