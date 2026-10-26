import type { CommentSide, ReviewComment } from '@reviewer/core/comments';
import type {
  CloseResult,
  MergeMethod,
  MergeResult,
  PullRequestInfo,
} from '@reviewer/core/ports/git-provider';
import { SERVER_PORT } from '../process/reviewerServer';

export type { MergeMethod, PullRequestInfo };

export class GitHubRequestError extends Error {}

export interface NewPullComment {
  filePath: string;
  side: CommentSide;
  lineNumber: number;
  body: string;
}

/**
 * The Reviewer server's pull-request API — what the Mac app's review page
 * uses. `repo` points every request at this repository's `origin`, whatever
 * project the server has open.
 */
export function githubClient(root: string) {
  let scoped: Promise<void> | null = null;
  const pull = (number: number) => `/api/github/pulls/${number}`;
  return {
    pulls: () => request<PullRequestInfo[]>('GET', '/api/github/pulls'),
    diff: (number: number) => request<string>('GET', `${pull(number)}/diff`),
    comments: (number: number) =>
      request<ReviewComment[]>('GET', `${pull(number)}/comments`),
    comment: (number: number, input: NewPullComment) =>
      request<ReviewComment>('POST', `${pull(number)}/comments`, input),
    reply: (number: number, commentId: number, body: string) =>
      request<ReviewComment>(
        'POST',
        `${pull(number)}/comments/${commentId}/replies`,
        { body },
      ),
    deleteComment: (number: number, commentId: number) =>
      request<unknown>('DELETE', `${pull(number)}/comments/${commentId}`),
    resolveThread: (number: number, threadId: string, resolved: boolean) =>
      request<unknown>(
        'PUT',
        `${pull(number)}/threads/${encodeURIComponent(threadId)}`,
        { resolved },
      ),
    merge: (number: number, method: MergeMethod) =>
      request<MergeResult>('POST', `${pull(number)}/merge`, { method }),
    close: (number: number) =>
      request<CloseResult>('POST', `${pull(number)}/close`, {}),
  };

  async function request<TResult>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<TResult> {
    scoped ??= ensureScoped().catch((error: unknown) => {
      scoped = null;
      throw error;
    });
    await scoped;
    const response = await call(
      `${path}?${new URLSearchParams({ repo: root })}`,
      method,
      body,
    );
    const parsed = (await response.json().catch(() => null)) as
      (TResult & { reason?: string; _tag?: string }) | null;
    if (!response.ok || parsed === null)
      throw new GitHubRequestError(
        parsed?.reason ??
          parsed?._tag ??
          `GitHub request failed (${response.status})`,
      );
    return parsed;
  }

  /**
   * A server from before `repo` would answer for whatever project it has
   * open; such a server is only asked when that project is this one.
   */
  async function ensureScoped(): Promise<void> {
    const spec = await call('/api/openapi.json');
    if (spec.ok && takesRepo(await spec.json().catch(() => null))) return;
    const open = (await (await call('/api/workspace')).json()) as {
      project?: string | null;
    };
    if (open.project === root) return;
    const name = open.project?.split('/').at(-1) ?? 'no project';
    throw new GitHubRequestError(
      `Reviewer server is on ${name} and too old to answer for this repo — restart it`,
    );
  }
}

export type GitHubClient = ReturnType<typeof githubClient>;

/** GitHub's numeric id behind a pull-request comment's `gh-…` id. */
export function githubCommentId(comment: ReviewComment): number | null {
  const id = Number(comment.id.replace(/^gh-/, ''));
  return Number.isInteger(id) ? id : null;
}

function takesRepo(spec: unknown): boolean {
  const parameters = (spec as OpenApiSpec | null)?.paths?.['/api/github/pulls']
    ?.get?.parameters;
  return parameters?.some((parameter) => parameter.name === 'repo') ?? false;
}

interface OpenApiSpec {
  paths?: Record<
    string,
    { get?: { parameters?: Array<{ name?: string }> } } | undefined
  >;
}

async function call(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<Response> {
  try {
    return await fetch(`http://127.0.0.1:${SERVER_PORT}${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new GitHubRequestError(NOT_ANSWERING);
  }
}

const NOT_ANSWERING =
  'The Reviewer server is not answering — it starts with the TUI unless --no-server';

/** A large diff is rebuilt from GitHub's file list, page by page. */
const REQUEST_TIMEOUT_MS = 60_000;
