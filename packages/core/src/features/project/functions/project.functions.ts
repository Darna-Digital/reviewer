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

/**
 * Rewrite a repository's diff so its paths read from the project root:
 * `a/src/a.ts` becomes `a/web-app/src/a.ts`. Prefixing lets one root's diff be
 * concatenated with another's and parsed as a single project diff, with every
 * path matching the tree it will be shown against.
 *
 * Only the path-bearing headers are touched. `/dev/null` stands for "no file
 * on this side" rather than a path, so it is left alone.
 */
export const prefixDiffPaths = (diff: string, prefix: string): string => {
  if (prefix.length === 0 || diff.length === 0) return diff;
  const path = (side: string, rest: string) =>
    rest === "/dev/null" ? rest : `${side}${prefix}/${rest.slice(side.length)}`;
  return diff
    .split("\n")
    .map((line) => {
      if (line.startsWith("diff --git a/")) {
        // Both paths sit on one line, and either may contain spaces; splitting
        // on " b/" would break a file called `a b/c`. Rewriting each `a/`-`b/`
        // pair positionally keeps such names intact.
        const body = line.slice("diff --git ".length);
        const half = body.indexOf(" b/");
        if (half === -1) return line;
        const left = body.slice(0, half);
        const right = body.slice(half + 1);
        return `diff --git ${path("a/", left)} ${path("b/", right)}`;
      }
      if (line.startsWith("--- ")) return `--- ${path("a/", line.slice(4))}`;
      if (line.startsWith("+++ ")) return `+++ ${path("b/", line.slice(4))}`;
      if (line.startsWith("rename from ")) {
        return `rename from ${prefix}/${line.slice("rename from ".length)}`;
      }
      if (line.startsWith("rename to ")) {
        return `rename to ${prefix}/${line.slice("rename to ".length)}`;
      }
      return line;
    })
    .join("\n");
};
