import type {
  ContentMatch,
  FileMatches,
  GrepOptions,
  GrepResults,
  MatchRange,
  SearchDependencies,
  SearchFunctions,
} from "../interfaces/search.interfaces";

export const EMPTY_GREP_RESULTS: GrepResults = {
  matches: [],
  truncated: false,
};

export const DEFAULT_GREP_OPTIONS: GrepOptions = {
  caseSensitive: false,
  wholeWord: false,
  regex: false,
};

export function createSearchFunctions(d: SearchDependencies): SearchFunctions {
  const grep: SearchFunctions["grep"] = async (query, options) => {
    const trimmed = query.trim();
    if (trimmed.length < d.data.minQueryLength) return EMPTY_GREP_RESULTS;
    return d.sideEffects.grep(trimmed, options);
  };

  return { grep };
}

/** Identity of a match in a list — a file can be hit twice on one line. */
export const matchKey = (match: ContentMatch): string =>
  `${match.path}:${match.line}:${match.column}`;

/**
 * Collect matches under their file, keeping git's order for both the files and
 * the lines within them, so the list reads top-to-bottom like the repository.
 */
export const groupByFile = (
  matches: ReadonlyArray<ContentMatch>
): ReadonlyArray<FileMatches> => {
  const byPath = new Map<string, Array<ContentMatch>>();
  for (const match of matches) {
    const existing = byPath.get(match.path);
    if (existing === undefined) byPath.set(match.path, [match]);
    else existing.push(match);
  }
  return [...byPath].map(([path, fileMatches]) => ({
    path,
    matches: fileMatches,
  }));
};

const escapeRegex = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Where the pattern hit `text`. The server reports a column, but not how long
 * the match was — under a regex only the pattern knows that — so the same match
 * rules run again here over the one line being drawn. An unparseable regex (the
 * user is still typing it) simply highlights nothing.
 */
export const matchRange = (
  text: string,
  query: string,
  options: GrepOptions
): MatchRange | null => {
  const trimmed = query.trim();
  if (trimmed.length === 0) return null;
  const source = options.regex ? trimmed : escapeRegex(trimmed);
  const pattern = options.wholeWord ? `\\b(?:${source})\\b` : source;
  try {
    const found = new RegExp(pattern, options.caseSensitive ? "" : "i").exec(
      text
    );
    if (found === null || found[0].length === 0) return null;
    return { start: found.index, end: found.index + found[0].length };
  } catch {
    return null;
  }
};
