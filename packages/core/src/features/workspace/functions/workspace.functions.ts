/**
 * The workspace rules, as plain functions.
 *
 * A project is a git repository — the folder you open is the folder git runs
 * in. What is decided here is how repositories are named, matched and ordered
 * for the opener, and how a repository's checked-out branch is read without
 * spawning git; the filesystem work lives in the repository layer, and this
 * stays pure so the server and the clients agree.
 */
import type { RepoEntry } from "../schema/workspace.schema.ts";

/** The trailing segment a folder is known by: `/a/b/web-app` → `web-app`. */
export const folderName = (path: string): string => {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed.split("/").at(-1) ?? trimmed;
};

/** The folder a repository sits in, with the home folder folded to `~`. */
export const repoLocation = (path: string, home: string): string => {
  const parent = path.replace(/\/+$/, "").split("/").slice(0, -1).join("/");
  if (parent === home) return "~";
  return parent.startsWith(`${home}/`)
    ? `~${parent.slice(home.length)}`
    : parent;
};

/** Match a repository against an opener query, over its name and its path. */
export const repoMatches = (repo: RepoEntry, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  return (
    repo.name.toLowerCase().includes(needle) ||
    repo.path.toLowerCase().includes(needle)
  );
};

/** The repositories opened before, most recent first — the opener's Recents. */
export const recentRepos = (
  repos: ReadonlyArray<RepoEntry>
): ReadonlyArray<RepoEntry> =>
  repos
    .filter((repo) => repo.lastOpened !== null)
    .sort((a, b) => (b.lastOpened ?? "").localeCompare(a.lastOpened ?? ""));

/**
 * The index folded with what the open history knows: a repository the scan
 * has not reached (or skipped) but that was opened before still belongs in
 * the list, and each entry carries its last open. Ordered by name so the
 * list does not shuffle between scans.
 */
export const mergeRepos = (
  scanned: ReadonlyArray<RepoEntry>,
  opened: ReadonlyArray<{ readonly path: string; readonly openedAt: string }>
): ReadonlyArray<RepoEntry> => {
  const openedAt = new Map(opened.map((entry) => [entry.path, entry.openedAt]));
  const byPath = new Map<string, RepoEntry>();
  for (const repo of scanned) {
    byPath.set(repo.path, {
      ...repo,
      lastOpened: openedAt.get(repo.path) ?? repo.lastOpened,
    });
  }
  for (const entry of opened) {
    if (byPath.has(entry.path)) continue;
    byPath.set(entry.path, {
      name: folderName(entry.path),
      path: entry.path,
      branch: null,
      lastOpened: entry.openedAt,
    });
  }
  return [...byPath.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path)
  );
};

/**
 * The branch name held in a `.git/HEAD` file, or null when HEAD is detached
 * (a raw sha) or the file is unreadable. Reading the file beats spawning git
 * for a scan that visits every repository on the machine.
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
 * turned out to be a file: a submodule or worktree points at the real
 * directory with `gitdir: <path>`. Null when the contents say nothing useful.
 */
export const parseGitDir = (contents: string): string | null => {
  const line = contents.trim();
  if (!line.startsWith("gitdir:")) return null;
  const dir = line.slice("gitdir:".length).trim();
  return dir.length === 0 ? null : dir;
};
