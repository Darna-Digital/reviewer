import { basename } from 'node:path';

/** One repository of the workspace; `name` heads its paths when there are several. */
export interface Repo {
  root: string;
  name: string;
}

/**
 * The repositories open side by side. With one, paths are the repository's
 * own; with several, each path is led by its repository's name
 * (`api/src/server.ts`), so the tree, the diff and the palette span them.
 */
export interface Repos {
  list: Repo[];
  spans: boolean;
  /** The saved workspace they are, or `null` for repositories opened on their own. */
  workspace: { id: string; name: string } | null;
}

export interface RepoPath {
  repo: Repo;
  /** Relative to the repository's root. */
  path: string;
}

export function reposOf(
  roots: string[],
  workspace: Repos['workspace'] = null,
): Repos {
  const names = uniqueNames(roots);
  return {
    list: roots.map((root, i) => ({ root, name: names[i]! })),
    spans: roots.length > 1,
    workspace,
  };
}

/** The workspace path of `path` in `repo`. */
export function inRepo(repos: Repos, repo: Repo, path: string): string {
  return repos.spans ? `${repo.name}/${path}` : path;
}

/** Which repository a workspace path is in, and the path inside it. */
export function locate(repos: Repos, path: string): RepoPath {
  const first = repos.list[0]!;
  if (!repos.spans) return { repo: first, path };
  const slash = path.indexOf('/');
  const name = slash === -1 ? path : path.slice(0, slash);
  const repo = repos.list.find((candidate) => candidate.name === name);
  return repo
    ? { repo, path: slash === -1 ? '' : path.slice(slash + 1) }
    : { repo: first, path };
}

export function repoNamed(repos: Repos, name: string): Repo | undefined {
  return repos.list.find((repo) => repo.name === name);
}

export function repoAt(repos: Repos, root: string): Repo | undefined {
  return repos.list.find((repo) => repo.root === root);
}

/** Workspace paths grouped by repository, each made relative to it. */
export function byRepo(
  repos: Repos,
  paths: string[],
): Array<{ repo: Repo; paths: string[] }> {
  return repos.list
    .map((repo) => ({
      repo,
      paths: paths
        .map((path) => locate(repos, path))
        .filter((at) => at.repo === repo)
        .map((at) => at.path),
    }))
    .filter((group) => group.paths.length > 0);
}

/** Folder names; from the second repository sharing one, numbered — `web 2`, as the Mac tree keys them. */
function uniqueNames(roots: string[]): string[] {
  const seen = new Map<string, number>();
  return roots.map((root) => {
    const name = basename(root);
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name} ${count}`;
  });
}
