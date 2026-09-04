/**
 * GitLab-backed review provider — the real implementation. Ports the shared
 * `GitProvider` port onto `GitLabClient` (project resolution + REST helpers),
 * so a merge request is read, commented on, merged and closed through exactly
 * the calls a pull request is.
 */
import * as Effect from "effect/Effect";
import { GitProviderError } from "@byconvo/core/ports/git-provider";
import type {
  GitProviderShape,
  MergeMethod,
} from "@byconvo/core/ports/git-provider";
import type { ReviewComment } from "@byconvo/core/comments";
import { unifiedDiff, type FileDiff } from "../reviews/unified-diff.ts";
import { GitLabClient } from "./gitlab-client.ts";
import {
  DISCUSSIONS_PER_QUERY,
  DISCUSSIONS_QUERY,
  MERGE_REQUESTS_PER_PAGE,
  MERGE_REQUESTS_QUERY,
  commentFromNote,
  commentsFromDiscussions,
  commentsFromGraphqlDiscussions,
  createdDiscussion,
  mergeRequestsFrom,
  mergeRequestsFromGraphql,
  parseCommentId,
  parseMergeRequestDiffs,
} from "./merge-request-mapping.ts";

const DIFFS_PER_PAGE = 100;
const MAX_DIFF_PAGES = 30;
const DISCUSSIONS_PER_PAGE = 100;
const MAX_DISCUSSION_PAGES = 10;

const notFound = (error: GitProviderError): boolean => error.status === 404;

/**
 * What to send GitLab so it merges the way the reviewer asked.
 *
 * GitLab has two of the app's three: a merge commit, and a squash — which is
 * the same merge with a flag on it. Rebasing is not a merge method there at
 * all but a project setting ("fast-forward merge"), so asking for it is
 * refused with the reason rather than quietly doing something else.
 */
export const mergePayload = (
  method: MergeMethod
): Record<string, unknown> | null => {
  switch (method) {
    case "merge":
      return { squash: false };
    case "squash":
      return { squash: true };
    case "rebase":
      return null;
  }
};

export const makeGitLabProvider = Effect.gen(function* () {
  const gl = yield* GitLabClient;

  const mergeRequestPath = (iid: number) =>
    Effect.map(
      gl.project,
      (project) => `/projects/${project.id}/merge_requests/${iid}`
    );

  /**
   * The plain listing. Always available — every GitLab has it, back to the
   * ones that predate their GraphQL API — but it knows nothing about CI and
   * does not count what the change touches.
   */
  const restMergeRequests = Effect.gen(function* () {
    const project = yield* gl.project;
    const data = yield* gl.getJson(
      `/projects/${project.id}/merge_requests` +
        `?state=opened&order_by=updated_at&sort=desc` +
        `&with_labels_details=true&per_page=${MERGE_REQUESTS_PER_PAGE}`
    );
    return mergeRequestsFrom(data);
  });

  /**
   * Every open merge request with the parts the review pane decides by — the
   * head pipeline, how big the change is, who is on it — in one request.
   *
   * GraphQL is asked first and the listing is the fallback rather than the
   * other way around, because the fallback is the lesser answer: a list that
   * cannot say a pipeline failed is still a usable list, and one that fails
   * because this GitLab is too old for a field in the query is not.
   */
  const pulls: GitProviderShape["pulls"] = Effect.gen(function* () {
    const project = yield* gl.project;
    return yield* gl
      .graphql(MERGE_REQUESTS_QUERY, {
        path: project.path,
        first: MERGE_REQUESTS_PER_PAGE,
      })
      .pipe(
        Effect.map((data) => mergeRequestsFromGraphql(data, project.webUrl)),
        Effect.catch((error) =>
          Effect.gen(function* () {
            yield* Effect.logInfo(
              `GitLab GraphQL is unavailable (${error.reason}); ` +
                "listing merge requests over REST without pipelines or line counts."
            );
            return yield* restMergeRequests;
          })
        )
      );
  });

  /**
   * The merge request's diff, page by page.
   *
   * `/diffs` is GitLab 15.7 and later; older installs only have `/changes`,
   * which answers the whole thing at once and is asked for only when `/diffs`
   * says it has never heard of it.
   */
  const pullDiff: GitProviderShape["pullDiff"] = (iid) =>
    Effect.gen(function* () {
      const base = yield* mergeRequestPath(iid);
      const pages: Array<FileDiff> = [];
      for (let page = 1; page <= MAX_DIFF_PAGES; page++) {
        const data = yield* gl.getJson(
          `${base}/diffs?per_page=${DIFFS_PER_PAGE}&page=${page}`
        );
        const parsed = parseMergeRequestDiffs(data);
        pages.push(...parsed);
        if (parsed.length < DIFFS_PER_PAGE) return unifiedDiff(pages);
      }
      yield* Effect.logWarning(
        `!${iid}: stopped after ${MAX_DIFF_PAGES} pages of files ` +
          `(${pages.length} files); the diff shown is incomplete.`
      );
      return unifiedDiff(pages);
    }).pipe(
      Effect.catchIf(notFound, () =>
        Effect.gen(function* () {
          const base = yield* mergeRequestPath(iid);
          yield* Effect.logInfo(
            `!${iid}: this GitLab has no /diffs endpoint; reading the change from /changes.`
          );
          const data = yield* gl.getJson(`${base}/changes`);
          return unifiedDiff(parseMergeRequestDiffs(data));
        })
      )
    );

  const restComments = (iid: number) =>
    Effect.gen(function* () {
      const base = yield* mergeRequestPath(iid);
      const comments: Array<ReviewComment> = [];
      for (let page = 1; page <= MAX_DISCUSSION_PAGES; page++) {
        const data = yield* gl.getJson(
          `${base}/discussions?per_page=${DISCUSSIONS_PER_PAGE}&page=${page}`
        );
        comments.push(...commentsFromDiscussions(data, iid));
        if (!Array.isArray(data) || data.length < DISCUSSIONS_PER_PAGE) break;
      }
      return comments;
    });

  /**
   * The line comments on a merge request, GraphQL first.
   *
   * Not for speed this time but for access: GitLab's REST notes refuse an
   * anonymous caller even on a public project, while GraphQL answers one. So
   * reading somebody's open source merge request with no token set works, the
   * way reading a public pull request without one does — and an install where
   * GraphQL is unavailable still reads them over REST.
   */
  const pullComments: GitProviderShape["pullComments"] = (iid) =>
    Effect.gen(function* () {
      const project = yield* gl.project;
      return yield* gl
        .graphql(DISCUSSIONS_QUERY, {
          path: project.path,
          iid: String(iid),
          first: DISCUSSIONS_PER_QUERY,
        })
        .pipe(
          Effect.map((data) => commentsFromGraphqlDiscussions(data, iid)),
          Effect.catch((error) =>
            Effect.gen(function* () {
              yield* Effect.logInfo(
                `GitLab GraphQL is unavailable (${error.reason}); ` +
                  `reading !${iid}'s comments over REST.`
              );
              return yield* restComments(iid);
            })
          )
        );
    });

  /**
   * The three shas a new comment has to be anchored against. GitLab positions
   * a note in the diff between two commits rather than on a line of a file, so
   * without these it has nowhere to put it — and answers 400 rather than
   * guessing.
   */
  const diffRefs = (iid: number) =>
    Effect.gen(function* () {
      const base = yield* mergeRequestPath(iid);
      const mr = (yield* gl.getJson(base)) as {
        diff_refs?: {
          base_sha?: unknown;
          head_sha?: unknown;
          start_sha?: unknown;
        } | null;
      };
      const refs = mr.diff_refs;
      const base_sha = refs?.base_sha;
      const head_sha = refs?.head_sha;
      const start_sha = refs?.start_sha;
      if (
        typeof base_sha !== "string" ||
        typeof head_sha !== "string" ||
        typeof start_sha !== "string"
      ) {
        return yield* Effect.fail(
          new GitProviderError({
            reason: `could not resolve the diff !${iid} is against`,
          })
        );
      }
      return { base_sha, head_sha, start_sha };
    });

  const createPullComment: GitProviderShape["createPullComment"] = (input) =>
    Effect.gen(function* () {
      const base = yield* mergeRequestPath(input.pullNumber);
      const refs = yield* diffRefs(input.pullNumber);
      const created = yield* gl.postJson(`${base}/discussions`, {
        body: input.body,
        position: {
          ...refs,
          position_type: "text",
          new_path: input.filePath,
          old_path: input.filePath,
          ...(input.side === "deletions"
            ? { old_line: input.lineNumber }
            : { new_line: input.lineNumber }),
        },
      });
      const discussion = createdDiscussion(created);
      if (discussion === null) {
        return yield* Effect.fail(
          new GitProviderError({
            reason: "GitLab created the comment but described no discussion",
          })
        );
      }
      return commentFromNote(discussion.note, {
        discussionId: discussion.discussionId,
        filePath: input.filePath,
        side: input.side,
        lineNumber: input.lineNumber,
        mergeRequestIid: input.pullNumber,
        body: input.body,
      });
    });

  /**
   * Reply in the thread a comment belongs to.
   *
   * The reply carries its parent's position rather than one of its own:
   * GitLab hangs every note in a discussion off the discussion's position, and
   * the app draws a thread by the line its comments share.
   */
  const replyToPullComment: GitProviderShape["replyToPullComment"] = (input) =>
    Effect.gen(function* () {
      const ref = parseCommentId(input.commentId);
      if (ref === null) {
        return yield* Effect.fail(
          new GitProviderError({
            reason: `not a GitLab comment id: ${input.commentId}`,
          })
        );
      }
      const base = yield* mergeRequestPath(input.pullNumber);
      // One discussion comes back as itself rather than as a list of one.
      const parents = commentsFromDiscussions(
        [yield* gl.getJson(`${base}/discussions/${ref.discussionId}`)],
        input.pullNumber
      );
      const parent = parents[0];
      const created = yield* gl.postJson(
        `${base}/discussions/${ref.discussionId}/notes`,
        { body: input.body }
      );
      return commentFromNote(created, {
        discussionId: ref.discussionId,
        filePath: parent?.filePath ?? "",
        side: parent?.side ?? "additions",
        lineNumber: parent?.lineNumber ?? 0,
        mergeRequestIid: input.pullNumber,
        body: input.body,
      });
    });

  const deletePullComment: GitProviderShape["deletePullComment"] = (input) =>
    Effect.gen(function* () {
      const ref = parseCommentId(input.commentId);
      if (ref === null) {
        return yield* Effect.fail(
          new GitProviderError({
            reason: `not a GitLab comment id: ${input.commentId}`,
          })
        );
      }
      const base = yield* mergeRequestPath(input.pullNumber);
      yield* gl.deleteResource(
        `${base}/discussions/${ref.discussionId}/notes/${ref.noteId}`
      );
    });

  /**
   * Land the merge request on its target branch.
   *
   * GitLab refuses with 405 (not mergeable — a draft, conflicts, a failing
   * pipeline the project requires) or 406 (it has already been merged or
   * closed), and its own sentence about which comes back with the failure.
   */
  const mergePull: GitProviderShape["mergePull"] = (iid, method) =>
    Effect.gen(function* () {
      const payload = mergePayload(method);
      if (payload === null) {
        return yield* Effect.fail(
          new GitProviderError({
            reason:
              "GitLab has no rebase merge: whether a merge request " +
              "fast-forwards is a project setting, not a choice made here. " +
              "Merge or squash instead.",
          })
        );
      }
      const base = yield* mergeRequestPath(iid);
      const merged = (yield* gl.putJson(`${base}/merge`, payload)) as {
        merge_commit_sha?: unknown;
        squash_commit_sha?: unknown;
        sha?: unknown;
        state?: unknown;
      };
      const sha = [
        merged.merge_commit_sha,
        merged.squash_commit_sha,
        merged.sha,
      ].find((value): value is string => typeof value === "string");
      return merged.state === "merged"
        ? { sha: sha ?? "", message: `Merged !${iid}` }
        : yield* Effect.fail(
            new GitProviderError({
              reason: `GitLab left !${iid} ${String(merged.state ?? "unmerged")}`,
            })
          );
    });

  /**
   * Close the merge request without merging it. GitLab answers with the merge
   * request itself, so the answer is the state it comes back in — anything but
   * `closed` means the call did not do what was asked.
   */
  const closePull: GitProviderShape["closePull"] = (iid) =>
    Effect.gen(function* () {
      const base = yield* mergeRequestPath(iid);
      const closed = (yield* gl.putJson(base, { state_event: "close" })) as {
        state?: unknown;
      };
      return closed.state === "closed"
        ? { message: `Closed !${iid}` }
        : yield* Effect.fail(
            new GitProviderError({
              reason: `GitLab left !${iid} ${String(closed.state ?? "unknown")}`,
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
