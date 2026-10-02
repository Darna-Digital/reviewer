/**
 * A pull request's review threads, as GitHub's GraphQL API tells them.
 *
 * The comments themselves are read over REST, which knows each comment's line
 * and nothing of the thread it is in — and a thread is the thing GitHub
 * resolves: there is no resolving one comment, and no REST call that resolves
 * anything. So the threads are asked for alongside, and what comes back is
 * folded into the comments by their database id, the one id both APIs share.
 * Reading that answer is the part worth testing, so it is a pure function
 * here, as `pull-request-mapping` keeps its own.
 */

export const REVIEW_THREADS_QUERY = `
  query ReviewThreads($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            comments(first: 100) { nodes { databaseId } }
          }
        }
      }
    }
  }
`;

export const RESOLVE_THREAD_MUTATION = `
  mutation ResolveThread($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) { thread { id } }
  }
`;

export const UNRESOLVE_THREAD_MUTATION = `
  mutation UnresolveThread($threadId: ID!) {
    unresolveReviewThread(input: { threadId: $threadId }) { thread { id } }
  }
`;

/** The thread a comment is in, and whether it is resolved. */
export interface CommentThread {
  readonly thread: string;
  readonly resolved: boolean;
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const nodes = (value: unknown): ReadonlyArray<Record<string, unknown>> => {
  const list = record(value)?.["nodes"];
  return Array.isArray(list)
    ? list.flatMap((node) => {
        const read = record(node);
        return read === null ? [] : [read];
      })
    : [];
};

/**
 * Every comment's thread, by the comment's database id — the `id` the REST
 * listing gives it. A shape it did not expect reads as no threads at all,
 * which leaves the comments as REST had them: still there, just with nothing
 * to resolve.
 */
export const threadsByComment = (
  data: unknown
): ReadonlyMap<number, CommentThread> => {
  const pullRequest = record(
    record(record(data)?.["repository"])?.["pullRequest"]
  );
  const byComment = new Map<number, CommentThread>();
  for (const thread of nodes(pullRequest?.["reviewThreads"])) {
    const id = thread["id"];
    if (typeof id !== "string") continue;
    const resolved = thread["isResolved"] === true;
    for (const comment of nodes(thread["comments"])) {
      const databaseId = comment["databaseId"];
      if (typeof databaseId === "number") {
        byComment.set(databaseId, { thread: id, resolved });
      }
    }
  }
  return byComment;
};
