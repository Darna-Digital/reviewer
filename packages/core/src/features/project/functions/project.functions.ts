/**
 * Reading a project's git state as one thing: merging the roots' histories,
 * counting what is uncommitted across them, and moving between a path as one
 * root knows it and the same path as the project knows it.
 */
import type { ProjectChanges, RepoChanges } from "../schema/project.schema.ts";
import type { RepoEntry } from "../../workspace/schema/workspace.schema.ts";

/**
 * A path as the project knows it: the root's name, then the path inside it —
 * `web-app/src/app/layout.tsx`. This is what a row spanning several roots has
 * to show, since `src/app/layout.tsx` alone could be any of them.
 */
export const projectPath = (repo: RepoEntry, path: string): string =>
  `${repo.name}/${path}`;

/**
 * Split a project path back into the root that owns it and the path within it.
 * Null when no root claims the path — a stale link, or a root since removed.
 */
export const splitProjectPath = (
  repos: ReadonlyArray<RepoEntry>,
  path: string
): { readonly repo: RepoEntry; readonly path: string } | null => {
  // Longest name first, so a nested root (`apps/web`) wins over a shallower
  // one that happens to share its opening segment.
  const ordered = [...repos].sort((a, b) => b.name.length - a.name.length);
  for (const repo of ordered) {
    if (path === repo.name) return { repo, path: "" };
    if (path.startsWith(`${repo.name}/`)) {
      return { repo, path: path.slice(repo.name.length + 1) };
    }
  }
  return null;
};

/**
 * Every root's commits as one history, newest first. Git already sorts each
 * root's own log, so this is a merge on author date; commits sharing a date
 * keep the roots' order, which keeps the list stable between reads.
 */
export const mergeCommits = <C extends { readonly authoredAt: string }>(
  perRepo: ReadonlyArray<{
    readonly repo: RepoEntry;
    readonly commits: ReadonlyArray<C>;
  }>
): ReadonlyArray<{ readonly repo: RepoEntry; readonly commit: C }> =>
  perRepo
    .flatMap(({ commits, repo }, order) =>
      commits.map((commit) => ({ commit, order, repo }))
    )
    .sort((a, b) => {
      const byDate = b.commit.authoredAt.localeCompare(a.commit.authoredAt);
      return byDate !== 0 ? byDate : a.order - b.order;
    })
    .map(({ commit, repo }) => ({ commit, repo }));

/** How many files are uncommitted across the whole project. */
export const changedFileCount = (changes: ProjectChanges): number =>
  changes.repos.reduce((count, entry) => count + entry.files.length, 0);

/** The roots that actually have uncommitted work, in project order. */
export const reposWithChanges = (
  changes: ProjectChanges
): ReadonlyArray<RepoChanges> =>
  changes.repos.filter((entry) => entry.files.length > 0);

/** Whether any root is ahead of, or behind, its upstream. */
export const projectIsOutOfSync = (changes: ProjectChanges): boolean =>
  changes.repos.some(
    (entry) => entry.status.ahead > 0 || entry.status.behind > 0
  );

/** Totals across the project, for a one-line summary of where things stand. */
export const projectTotals = (
  changes: ProjectChanges
): {
  readonly changed: number;
  readonly ahead: number;
  readonly behind: number;
  readonly conflicted: number;
} =>
  changes.repos.reduce(
    (totals, entry) => ({
      changed: totals.changed + entry.files.length,
      ahead: totals.ahead + entry.status.ahead,
      behind: totals.behind + entry.status.behind,
      conflicted: totals.conflicted + entry.status.conflicted,
    }),
    { changed: 0, ahead: 0, behind: 0, conflicted: 0 }
  );
