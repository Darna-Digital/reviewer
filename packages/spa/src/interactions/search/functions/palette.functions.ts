import type {
  Command,
  Crumb,
  SearchMode,
} from "../interfaces/search.interfaces";

/** Typing the whole repository into the list helps nobody. */
export const MAX_FILE_RESULTS = 40;

export const MODE_LABELS: Record<SearchMode, string> = {
  commands: "Commands",
  files: "Files",
  text: "Text",
};

/**
 * Where you are in the dialog. The command list is the root of every trail, so
 * the header keeps its shape as you move between modes instead of appearing
 * only once you are somewhere deeper.
 */
export const crumbsFor = (mode: SearchMode): ReadonlyArray<Crumb> =>
  mode === "commands"
    ? [{ mode: "commands", label: MODE_LABELS.commands }]
    : [
        { mode: "commands", label: MODE_LABELS.commands },
        { mode, label: MODE_LABELS[mode] },
      ];

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

/** Split a path into its directory (dimmed in the list) and file name. */
export const splitPath = (
  path: string
): { readonly directory: string; readonly name: string } => {
  const slash = path.lastIndexOf("/");
  return slash === -1
    ? { directory: "", name: path }
    : { directory: path.slice(0, slash + 1), name: path.slice(slash + 1) };
};
