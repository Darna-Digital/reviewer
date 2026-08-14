import {
  IconFile,
  IconGitBranch,
  IconGitFork,
  IconSearch,
} from "@tabler/icons-react";
import type {
  BranchChoice,
  BranchInfo,
  Command,
  Crumb,
  RemoteBranchInfo,
  SearchMode,
  Submenu,
} from "../interfaces/search.interfaces";

/** Typing the whole repository into the list helps nobody. */
export const MAX_FILE_RESULTS = 40;

/** Same for a repository whose remote has a branch per open ticket. */
export const MAX_BRANCH_RESULTS = 40;

export const MODE_LABELS: Record<SearchMode, string> = {
  commands: "Commands",
  files: "Files",
  text: "Text",
  git: "Git",
  branches: "Branches",
};

/**
 * Every list past the command list, and the one it hangs off. Declaring the
 * shape of the dialog once is what keeps a mode's breadcrumb trail, the row that
 * opens it and the list Backspace returns to from drifting apart.
 */
export const SUBMENUS: ReadonlyArray<Submenu> = [
  {
    mode: "files",
    parent: "commands",
    label: "Go to File…",
    group: "Search",
    icon: IconFile,
    keywords: "open path jump navigate",
    hint: "⇧⇧",
  },
  {
    mode: "text",
    parent: "commands",
    label: "Search in Files…",
    group: "Search",
    icon: IconSearch,
    keywords: "grep content text find occurrences",
    hint: "⇧⌘F",
  },
  {
    mode: "git",
    parent: "commands",
    label: "Git Actions…",
    group: "Git",
    icon: IconGitFork,
    keywords: "fetch pull push branch merge rebase",
  },
  {
    mode: "branches",
    parent: "git",
    label: "Switch Branch…",
    group: "Git",
    icon: IconGitBranch,
    keywords: "checkout switch change branch",
  },
];

/** The list `mode` sits under, or null for the command list at the root. */
export const parentOf = (mode: SearchMode): SearchMode | null =>
  SUBMENUS.find((submenu) => submenu.mode === mode)?.parent ?? null;

/**
 * Where you are in the dialog. The command list is the root of every trail, so
 * the header keeps its shape as you move between modes instead of appearing
 * only once you are somewhere deeper.
 */
export const crumbsFor = (mode: SearchMode): ReadonlyArray<Crumb> => {
  const trail: Array<Crumb> = [];
  for (let step: SearchMode | null = mode; step !== null; step = parentOf(step))
    trail.unshift({ mode: step, label: MODE_LABELS[step] });
  return trail;
};

/**
 * A query typed at the root searches the submenus too. Grouping the git actions
 * behind a breadcrumb is meant to tidy the list you land on, not to hide "Push"
 * from someone who types it.
 */
const reachesEverything = (mode: SearchMode, query: string): boolean =>
  mode === "commands" && query.trim().length > 0;

/** The rows that walk deeper from `mode`. */
export const submenusIn = (
  mode: SearchMode,
  query: string
): ReadonlyArray<Submenu> =>
  SUBMENUS.filter(
    (submenu) => submenu.parent === mode || reachesEverything(mode, query)
  );

/** The commands that live in `mode`. */
export const commandsIn = (
  mode: SearchMode,
  commands: ReadonlyArray<Command>,
  query: string
): ReadonlyArray<Command> =>
  commands.filter(
    (command) =>
      (command.submenu ?? "commands") === mode || reachesEverything(mode, query)
  );

/**
 * Subsequence match: every char of `query` must appear in `text` in order.
 * Returns a score (lower = better: tighter, earlier matches win) or null for no
 * match. Empty query matches everything with a neutral score.
 */
export const fuzzyScore = (text: string, query: string): number | null => {
  if (query === "") return 0;
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  let from = 0;
  let firstHit = -1;
  let lastHit = -1;
  for (const character of needle) {
    const found = haystack.indexOf(character, from);
    if (found === -1) return null;
    if (firstHit === -1) firstHit = found;
    lastHit = found;
    from = found + 1;
  }
  // Reward an early start and a compact span (how spread-out the match is).
  return firstHit + (lastHit - firstHit) * 0.5;
};

const byScore = <T>(scored: Array<{ value: T; score: number }>) =>
  scored.sort((a, b) => a.score - b.score).map(({ value }) => value);

/** Commands matching `query`, best first. Labels, keywords and groups all count. */
export const filterCommands = (
  commands: ReadonlyArray<Command>,
  query: string
): ReadonlyArray<Command> =>
  byScore(
    commands.flatMap((command) => {
      const score = fuzzyScore(
        `${command.label} ${command.keywords ?? ""} ${command.group}`,
        query
      );
      return score === null ? [] : [{ value: command, score }];
    })
  );

/** Paths matching `query`, best first and capped. A blank query matches nothing:
 * the whole file list is not a search result. */
export const filterFiles = (
  paths: ReadonlyArray<string>,
  query: string,
  limit: number = MAX_FILE_RESULTS
): ReadonlyArray<string> => {
  if (query.trim().length === 0) return [];
  return byScore(
    paths.flatMap((path) => {
      const score = fuzzyScore(path, query);
      return score === null ? [] : [{ value: path, score }];
    })
  ).slice(0, limit);
};

const trackingHint = (branch: BranchInfo): string | undefined => {
  const counts = [
    branch.ahead > 0 ? `↑${branch.ahead}` : "",
    branch.behind > 0 ? `↓${branch.behind}` : "",
  ].filter((count) => count !== "");
  return counts.length === 0 ? undefined : counts.join(" ");
};

/**
 * The branches to offer for checkout: the one you are on first, then the rest of
 * the local branches, then the remote branches that have no local counterpart —
 * a remote you already track is the same branch twice.
 */
export const branchChoices = (
  local: ReadonlyArray<BranchInfo>,
  remote: ReadonlyArray<RemoteBranchInfo>
): ReadonlyArray<BranchChoice> => {
  const tracked = new Set(local.map((branch) => branch.name));
  return [
    ...[...local]
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
      .map((branch): BranchChoice => ({
        name: branch.name,
        ref: branch.name,
        group: "Local",
        isCurrent: branch.isCurrent,
        hint: branch.isCurrent ? "current" : trackingHint(branch),
      })),
    ...remote
      .filter((branch) => !tracked.has(branch.shortName))
      .map((branch): BranchChoice => ({
        name: branch.name,
        ref: branch.shortName,
        group: "Remote",
        isCurrent: false,
        hint: branch.remote,
      })),
  ];
};

/** Branches matching `query`, best first and capped. A blank query keeps them
 * all: the list is short enough to read, unlike the file list. */
export const filterBranches = (
  branches: ReadonlyArray<BranchChoice>,
  query: string,
  limit: number = MAX_BRANCH_RESULTS
): ReadonlyArray<BranchChoice> =>
  byScore(
    branches.flatMap((branch) => {
      const score = fuzzyScore(branch.name, query);
      return score === null ? [] : [{ value: branch, score }];
    })
  ).slice(0, limit);

/** Split a path into its directory (dimmed in the list) and file name. */
export const splitPath = (
  path: string
): { readonly directory: string; readonly name: string } => {
  const slash = path.lastIndexOf("/");
  return slash === -1
    ? { directory: "", name: path }
    : { directory: path.slice(0, slash + 1), name: path.slice(slash + 1) };
};
