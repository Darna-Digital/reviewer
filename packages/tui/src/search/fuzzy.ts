import type { GrepOptions } from '../git/files';

/**
 * Case-insensitive subsequence match, scored as the Mac palette scores it:
 * where the first letter lands plus half the span the letters cover. Lower
 * is better; `null` is no match.
 */
export function fuzzyScore(text: string, query: string): number | null {
  if (!query) return 0;
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  let first = -1;
  let at = -1;
  for (const char of needle) {
    at = haystack.indexOf(char, at + 1);
    if (at === -1) return null;
    if (first === -1) first = at;
  }
  return first + 0.5 * (at - first);
}

/** Items that match, best first, ties kept in their original order. */
export function fuzzyFilter<TItem>(
  items: TItem[],
  query: string,
  textOf: (item: TItem) => string,
  limit = Infinity,
): TItem[] {
  return items
    .map((item, index) => ({
      item,
      index,
      score: fuzzyScore(textOf(item), query),
    }))
    .filter((entry) => entry.score !== null)
    .sort((a, b) => a.score! - b.score! || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}

/** Where the query first matches in a grep hit's line: `[start, end)`. */
export function matchRange(
  text: string,
  query: string,
  opts: GrepOptions,
): [number, number] | null {
  try {
    const source = opts.regex ? query : escapeRegExp(query);
    const bounded = opts.wholeWord ? `\\b(?:${source})\\b` : source;
    const found = new RegExp(bounded, opts.caseSensitive ? '' : 'i').exec(text);
    return found && found[0].length > 0
      ? [found.index, found.index + found[0].length]
      : null;
  } catch {
    return null;
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
