/**
 * Reading a project's git state as one thing: merging the roots' histories,
 * counting what is uncommitted across them, and moving between a path as one
 * root knows it and the same path as the project knows it.
 */
import type { ProjectChanges, RepoChanges } from "../schema/project.schema.ts";
import type {
  ContentMatch,
  ContentMatches,
} from "../../repo/schema/repo.schema.ts";
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

/**
 * Every root's grep hits as one result, in project order, with each path named
 * from the project root. Roots are kept whole rather than interleaved: matches
 * are read grouped under their file, and a root's files belong together.
 *
 * Each root is asked for a full page, since any one of them could supply the
 * whole result; the limit is applied to the merged list, and the result counts
 * as truncated when a root said so or when the merge itself had to cut.
 */
export const mergeMatches = (
  perRepo: ReadonlyArray<{
    readonly repo: RepoEntry;
    readonly matches: ContentMatches;
  }>,
  limit: number
): ContentMatches => {
  const all: Array<ContentMatch> = perRepo.flatMap(({ matches, repo }) =>
    matches.matches.map((match) => ({
      ...match,
      path: projectPath(repo, match.path),
    }))
  );
  return {
    matches: all.slice(0, limit),
    truncated:
      all.length > limit || perRepo.some((entry) => entry.matches.truncated),
  };
};

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
 * Split project paths into the roots that own them, in project order, keeping
 * only the roots that got any. This is what turns one selection spanning
 * `backend` and `frontend` into the commits each of them needs; a path no root
 * claims is dropped rather than guessed at.
 */
export const groupPathsByRepo = (
  repos: ReadonlyArray<RepoEntry>,
  paths: ReadonlyArray<string>
): ReadonlyArray<{
  readonly repo: RepoEntry;
  readonly paths: ReadonlyArray<string>;
}> => {
  const byRoot = new Map<string, Array<string>>();
  for (const path of paths) {
    const split = splitProjectPath(repos, path);
    if (split === null) continue;
    const held = byRoot.get(split.repo.path);
    if (held === undefined) byRoot.set(split.repo.path, [split.path]);
    else held.push(split.path);
  }
  return repos.flatMap((repo) => {
    const held = byRoot.get(repo.path);
    return held === undefined ? [] : [{ repo, paths: held }];
  });
};

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

/**
 * Narrow a merged history to one root, or leave it whole. The filter is by
 * root path rather than name because a name is only unique within a project,
 * and the same list is read while the project is being changed underneath it.
 */
export const filterCommitsByRepo = <C>(
  commits: ReadonlyArray<{ readonly repo: RepoEntry; readonly commit: C }>,
  repoPath: string | null
): ReadonlyArray<{ readonly repo: RepoEntry; readonly commit: C }> =>
  repoPath === null
    ? commits
    : commits.filter((entry) => entry.repo.path === repoPath);
