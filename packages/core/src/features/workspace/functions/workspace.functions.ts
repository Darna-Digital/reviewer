/**
 * The multi-repo project rules, as plain functions.
 *
 * A project is a folder. It is either a git repository itself or a parent
 * holding several (`backend`, `frontend`) — the shape JetBrains calls a
 * multi-root project. Everything here is the decision-making that shape needs:
 * which root a project opens on, what a root is called, whether the roots have
 * drifted apart. The filesystem work lives in the repository; this stays pure
 * so both the server and the SPA can rely on the same answers.
 */
import type {
  BrowseEntry,
  RepoEntry,
  WorkspaceInfo,
} from "../schema/workspace.schema.ts";

/** The trailing segment a folder is known by: `/a/b/web-app` → `web-app`. */
export const folderName = (path: string): string => {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed.split("/").at(-1) ?? trimmed;
};

/**
 * What a git root is called inside its project: the path relative to the
 * project root, so a nested one reads as `apps/web`. A project that is itself
 * a repository is named after its folder rather than the empty string.
 */
export const repoName = (project: string, repoPath: string): string => {
  const root = project.replace(/\/+$/, "");
  if (repoPath === root) return folderName(root);
  return repoPath.startsWith(`${root}/`)
    ? repoPath.slice(root.length + 1)
    : folderName(repoPath);
};

/**
 * The root a project should open on: the one it was last left on when that is
 * still there, otherwise the first. Null for a project holding no repository —
 * a real state (an empty folder, or one whose repos were removed), not an error.
 */
export const chooseRepo = (
  repos: ReadonlyArray<RepoEntry>,
  preferred: string | null
): string | null => {
  const kept = repos.find((repo) => repo.path === preferred);
  return kept?.path ?? repos[0]?.path ?? null;
};

/** The entry `info.current` points at, or null when the project holds none. */
export const activeRepo = (
  info: Pick<WorkspaceInfo, "repos" | "current">
): RepoEntry | null =>
  info.repos.find((repo) => repo.path === info.current) ?? null;

/** Whether the project holds more than one root — the multi-root case. */
export const isMultiRepo = (info: Pick<WorkspaceInfo, "repos">): boolean =>
  info.repos.length > 1;

/**
 * Whether the project's roots sit on different branches. JetBrains warns about
 * this ("branches have diverged") because a multi-root project is normally
 * worked on one feature branch across every root; detached or unreadable heads
 * are left out of the comparison rather than counted as a difference.
 */
export const branchesDiverged = (repos: ReadonlyArray<RepoEntry>): boolean => {
  const named = repos.flatMap((repo) =>
    repo.branch === null ? [] : [repo.branch]
  );
  return new Set(named).size > 1;
};

/** The branch every root shares, or null when they differ or none is readable. */
export const commonBranch = (
  repos: ReadonlyArray<RepoEntry>
): string | null => {
  const named = repos.flatMap((repo) =>
    repo.branch === null ? [] : [repo.branch]
  );
  if (named.length === 0 || named.length !== repos.length) return null;
  return branchesDiverged(repos) ? null : (named[0] ?? null);
};

/** What a browsed folder holds, for the picker to show — null when nothing. */
type BrowsedFolder = Pick<BrowseEntry, "isGitRepo" | "repoCount">;

/**
 * Whether a browsed folder can be opened as a project: a repository, or a
 * parent holding some. This is the assumption the picker used to get wrong —
 * only repositories were openable, so a `backend` + `frontend` parent could
 * only be stepped through, never opened.
 */
export const isOpenable = (folder: BrowsedFolder): boolean =>
  folder.isGitRepo || folder.repoCount > 0;

/** How a browsed folder describes itself in the picker, or null when plain. */
export const folderHint = (folder: BrowsedFolder): string | null => {
  if (folder.isGitRepo) return "Repository";
  if (folder.repoCount === 0) return null;
  return `${folder.repoCount} ${
    folder.repoCount === 1 ? "repository" : "repositories"
  }`;
};

/** Match a repository against a picker query, over both its name and its path. */
export const repoMatches = (repo: RepoEntry, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  return (
    repo.name.toLowerCase().includes(needle) ||
    repo.path.toLowerCase().includes(needle)
  );
};

/**
 * The branch name held in a `.git/HEAD` file, or null when HEAD is detached
 * (a raw sha) or the file is unreadable. Reading the file beats spawning git
 * once a project has a dozen roots and every workspace read would spawn one
 * process per root.
 */
export const parseHeadRef = (contents: string): string | null => {
  const line = contents.trim();
  if (!line.startsWith("ref:")) return null;
  const ref = line.slice("ref:".length).trim();
  if (ref.length === 0) return null;
  return ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
};

/**
 * Where a repository keeps its git data, given the contents of a `.git` that
 * turned out to be a file: linked worktrees and submodules point at the real
 * directory with `gitdir: <path>`. Null when the contents say nothing useful.
 */
export const parseGitDir = (contents: string): string | null => {
  const line = contents.trim();
  if (!line.startsWith("gitdir:")) return null;
  const dir = line.slice("gitdir:".length).trim();
  return dir.length === 0 ? null : dir;
};
