import type { RepoIndex, SavedWorkspace } from '@reviewer/core/workspace';
import { SERVER_PORT } from '../process/reviewerServer';

export type { SavedWorkspace };

export class WorkspaceRequestError extends Error {}

/** The repositories to offer: opened before (latest first), then the rest found on disk. */
export interface KnownRepos {
  recent: string[];
  found: string[];
}

/**
 * The Reviewer server's saved workspaces — what the Mac app's opener lists
 * and edits — and the repositories it knows of. Saving one here never
 * changes what the server has open, unless it is the workspace open there.
 */
export const workspaces = {
  list: () => request<SavedWorkspace[]>('GET', '/api/workspaces'),
  find: async (id: string) =>
    (await workspaces.list()).find((saved) => saved.id === id) ?? null,
  create: (name: string, roots: string[]) =>
    request<SavedWorkspace>('POST', '/api/workspaces', { name, roots }),
  update: (id: string, patch: { name?: string; roots?: string[] }) =>
    request<SavedWorkspace>('PATCH', at(id), patch),
  remove: (id: string) => request<unknown>('DELETE', at(id)),
  async known(): Promise<KnownRepos> {
    const index = await request<RepoIndex>('GET', '/api/repos');
    const opened = index.repos
      .filter((repo) => repo.lastOpened !== null)
      .sort((a, b) => b.lastOpened!.localeCompare(a.lastOpened!));
    return {
      recent: opened.map((repo) => repo.path),
      found: index.repos
        .filter((repo) => repo.lastOpened === null)
        .map((repo) => repo.path),
    };
  },
};

function at(id: string): string {
  return `/api/workspaces/${encodeURIComponent(id)}`;
}

async function request<TResult>(
  method: string,
  path: string,
  body?: unknown,
): Promise<TResult> {
  let response: Response;
  try {
    response = await fetch(`http://127.0.0.1:${SERVER_PORT}${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new WorkspaceRequestError(NOT_ANSWERING);
  }
  const parsed = (await response.json().catch(() => null)) as
    (TResult & { reason?: string; _tag?: string }) | null;
  if (!response.ok || parsed === null)
    throw new WorkspaceRequestError(
      parsed?.reason ??
        parsed?._tag ??
        `Workspace request failed (${response.status})`,
    );
  return parsed;
}

const NOT_ANSWERING =
  'The Reviewer server is not answering — workspaces are kept there; it starts with the TUI unless --no-server';

const REQUEST_TIMEOUT_MS = 10_000;
