/**
 * What ⌘F actually means, as arithmetic over a string.
 *
 * Matching runs line by line rather than over the whole file: a match is drawn
 * as a slice of one rendered line, so that is the shape it is found in, and a
 * pattern can never straddle a newline the way a `git grep` pattern cannot.
 */
import type {
  FindAnchor,
  FindDirection,
  FindMatch,
  FindOptions,
  TextPosition,
} from "../interfaces/find-in-file.interfaces";

export const DEFAULT_FIND_OPTIONS: FindOptions = {
  caseSensitive: false,
  wholeWord: false,
  regex: false,
};

/**
 * Where counting stops. A one-letter query in a big file matches tens of
 * thousands of times, and neither the counter nor the highlight is worth the
 * frame it would cost — the matches past this are simply not there.
 */
export const MAX_FIND_MATCHES = 2_000;

/** Longer than any phrase worth carrying into a search box from a selection. */
export const MAX_SEED_LENGTH = 200;

const escapeRegex = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The pattern behind a query and its modifiers, or null when there is nothing
 * to search for — including a regular expression the user has not finished
 * typing, which is a half-written query rather than an error to report.
 */
export const findPattern = (
  query: string,
  options: FindOptions
): RegExp | null => {
  if (query.length === 0) return null;
  const source = options.regex ? query : escapeRegex(query);
  const pattern = options.wholeWord ? `\\b(?:${source})\\b` : source;
  try {
    return new RegExp(pattern, options.caseSensitive ? "g" : "gi");
  } catch {
    return null;
  }
};

/** Every hit in `contents`, in reading order, capped at `MAX_FIND_MATCHES`. */
export const findMatches = (
  contents: string,
  query: string,
  options: FindOptions
): ReadonlyArray<FindMatch> => {
  const pattern = findPattern(query, options);
  if (pattern === null) return [];

  const found: Array<FindMatch> = [];
  const lines = contents.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    pattern.lastIndex = 0;
    let hit = pattern.exec(line);
    while (hit !== null) {
      // A pattern that can match nothing — `a*`, or a lone `\b` — leaves
      // `lastIndex` where it was, so stepping past it is what ends the loop.
      if (hit[0].length === 0) {
        pattern.lastIndex += 1;
      } else {
        found.push({
          line: index + 1,
          start: hit.index,
          end: hit.index + hit[0].length,
        });
        if (found.length >= MAX_FIND_MATCHES) return found;
      }
      hit = pattern.exec(line);
    }
  }
  return found;
};

/** Step to the neighbouring match, wrapping at both ends the way editors do. */
export const stepIndex = (
  count: number,
  current: number,
  direction: FindDirection
): number => {
  if (count <= 0) return 0;
  const from = Math.min(Math.max(current, 0), count - 1);
  return direction === "next" ? (from + 1) % count : (from - 1 + count) % count;
};

/**
 * The first match at or after `anchor` — what makes typing a query jump to the
 * next hit below the caret rather than back to the top of the file. Wraps to
 * the first match when everything is behind the anchor.
 */
export const indexFrom = (
  matches: ReadonlyArray<FindMatch>,
  anchor: FindAnchor | null
): number => {
  if (matches.length === 0 || anchor === null) return 0;
  const at = matches.findIndex(
    (match) =>
      match.line > anchor.line ||
      (match.line === anchor.line && match.start >= anchor.character)
  );
  return at === -1 ? 0 : at;
};

/**
 * How the counter reads. Empty before anything has been typed, so an untouched
 * bar does not accuse the file of having no results in it.
 */
export const findStatus = (
  query: string,
  count: number,
  index: number
): string => {
  if (query.length === 0) return "";
  if (count === 0) return "No results";
  const shown = Math.min(Math.max(index, 0), count - 1) + 1;
  const total = count >= MAX_FIND_MATCHES ? `${count}+` : `${count}`;
  return `${shown} of ${total}`;
};

/**
 * The part of a selection that can seed a search box: a single line of it,
 * trimmed, and short enough to be a phrase. A paragraph dragged out of a file
 * is not a query, and seeding one would throw away whatever was in the box.
 */
export const seedFromSelection = (selected: string): string => {
  const trimmed = selected.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SEED_LENGTH) return "";
  return /[\r\n]/.test(trimmed) ? "" : trimmed;
};

/**
 * The text between two zero-based positions — how a selection the editor
 * reports as a pair of positions becomes the phrase it covers.
 */
export const sliceRange = (
  contents: string,
  start: TextPosition,
  end: TextPosition
): string => {
  const lines = contents.split("\n");
  const [from, to] =
    start.line < end.line ||
    (start.line === end.line && start.character <= end.character)
      ? [start, end]
      : [end, start];
  if (from.line < 0 || from.line >= lines.length) return "";
  const last = Math.min(to.line, lines.length - 1);
  if (from.line === last) {
    return lines[from.line].slice(from.character, to.character);
  }
  const parts = [lines[from.line].slice(from.character)];
  for (let index = from.line + 1; index < last; index++)
    parts.push(lines[index]);
  parts.push(lines[last].slice(0, to.character));
  return parts.join("\n");
};
