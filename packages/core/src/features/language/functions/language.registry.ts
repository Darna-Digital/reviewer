/**
 * Provider selection — which installed language provider owns a given file.
 *
 * Kept structural (anything with `patterns` matches) so the rules can be tested
 * without constructing real providers, and so the server can reuse them when it
 * merges configured providers with the built-in ones.
 */

/** Matchable shape of a provider — the full port satisfies it structurally. */
export interface PatternOwner {
  readonly patterns: ReadonlyArray<string>;
}

/** Basename of a POSIX or Windows path. */
export const basenameOf = (path: string): string => {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return cut === -1 ? path : path.slice(cut + 1);
};

/**
 * Lowercased extension including the dot, or `""` when there is none.
 * A leading dot makes a dotfile (`.gitignore`) extension-less, matching POSIX
 * convention; `index.d.ts` reports `.ts`, which is what providers register.
 */
export const extensionOf = (path: string): string => {
  const name = basenameOf(path);
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "";
  return name.slice(dot).toLowerCase();
};

/**
 * Whether `pattern` claims `path`. Patterns starting with `.` match the
 * extension; the rest match a whole basename (`Dockerfile`, `Makefile`).
 * Matching is case-insensitive.
 */
export const patternMatches = (pattern: string, path: string): boolean => {
  const normalized = pattern.trim().toLowerCase();
  if (normalized.length === 0) return false;
  return normalized.startsWith(".")
    ? extensionOf(path) === normalized
    : basenameOf(path).toLowerCase() === normalized;
};

/**
 * The first provider claiming `path`, or null when none does. Order is
 * priority: the server puts repository-configured providers ahead of the
 * built-in ones so a project can override how its files are analysed.
 */
export const selectProvider = <P extends PatternOwner>(
  providers: ReadonlyArray<P>,
  path: string
): P | null => {
  if (path.trim().length === 0) return null;
  for (const provider of providers) {
    if (provider.patterns.some((pattern) => patternMatches(pattern, path)))
      return provider;
  }
  return null;
};

/**
 * Parse the `line`/`character` query params of a position request. Returns null
 * for anything that is not a non-negative integer, so the caller can report a
 * domain failure instead of leaking a decode error.
 */
export const parsePositionQuery = (query: {
  readonly line: string;
  readonly character: string;
}): { readonly line: number; readonly character: number } | null => {
  const line = parseIndex(query.line);
  const character = parseIndex(query.character);
  if (line === null || character === null) return null;
  return { line, character };
};

const parseIndex = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
};
