/**
 * Which repository a path belongs to, and where that repository sits in the
 * project.
 *
 * Providers work against one root: a language server is spawned per root,
 * `.byconvo/languages.json` is read per root, and a definition landing outside
 * the root is dropped. So the owning root is resolved here, and the prefix it
 * sits at is what turns its answers back into names the rest of the app can
 * open.
 *
 * Two path spellings arrive, because two kinds of view ask. The tree, search
 * and the worktree diff name files from the project (`web-app/src/a.ts`), since
 * a project may hold several roots and a file in any of them opens without
 * switching anything first. A commit or a range belongs to one root and is read
 * from it, so git names those files from that root (`src/a.ts`). Whichever
 * spelling points at a file that exists wins, which keeps both kinds of view
 * working without either having to say which it meant.
 *
 * A single-repo project is the same code path with nothing to do: the two
 * spellings coincide, the nearest root is the project itself, and the prefix is
 * empty.
 */
import { existsSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";

export interface RepoLocation {
  /** Absolute root the provider works against. */
  readonly root: string;
  /** The requested file, relative to that root. */
  readonly path: string;
  /** The root's own project-relative path; empty when it is the project. */
  readonly prefix: string;
}

const within = (root: string, path: string): boolean =>
  path === root || path.startsWith(`${root}/`);

const under = (root: string, path: string): string =>
  path === root ? "" : path.slice(root.length + 1);

/** The innermost git root at or above `absolute`, bounded by the project. */
const rootHolding = (project: string, absolute: string): string => {
  for (
    let directory = dirname(absolute);
    within(project, directory);
    directory = dirname(directory)
  ) {
    if (existsSync(`${directory}/.git`)) return directory;
    if (directory === project) break;
  }
  return project;
};

const locationOf = (project: string, absolute: string): RepoLocation => {
  const root = rootHolding(project, absolute);
  return { root, path: under(root, absolute), prefix: under(project, root) };
};

/**
 * The repository holding `path`, named relative to `project`. `current` is the
 * root the git views are pointed at, which is what a path from a commit diff is
 * named against.
 *
 * Falls back to reading the path as project-relative — when nothing on disk
 * matches, when it escapes the project, and when no git root holds it, so a
 * plain folder still gets an inferred TypeScript project rather than no
 * analysis at all.
 */
export const locateRepo = (
  project: string,
  current: string | null,
  path: string
): RepoLocation => {
  const cleaned = path.replace(/^\/+/, "");
  const fromProject = pathResolve(`${project}/${cleaned}`);
  if (!within(project, fromProject)) {
    return { root: project, path: cleaned, prefix: "" };
  }
  if (existsSync(fromProject)) return locationOf(project, fromProject);

  if (current !== null && current !== project && within(project, current)) {
    const fromCurrent = pathResolve(`${current}/${cleaned}`);
    if (within(project, fromCurrent) && existsSync(fromCurrent)) {
      return locationOf(project, fromCurrent);
    }
  }
  return locationOf(project, fromProject);
};
