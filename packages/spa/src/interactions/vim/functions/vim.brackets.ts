/**
 * Getting around code by its structure rather than by its words.
 *
 * These are the motions that make a modal editor worth using in a file of
 * nested blocks: the matching bracket, the walls of the block the caret is
 * inside, the paragraph, and the top-level section. All of them are pure
 * functions of the lines and the caret, like every other motion.
 *
 * Brackets are matched by counting characters, which is what Vim's own `%` does
 * before a filetype plugin teaches it better. A brace inside a string or a
 * comment is therefore counted — the alternative is a parser per language, and
 * being wrong in the same places Vim is wrong is a better trade than being
 * slow, or than not having the motion at all.
 */
import type { VimPosition } from "../interfaces/vim.interfaces";

const PAIRS: Readonly<Record<string, string>> = {
  "(": ")",
  "[": "]",
  "{": "}",
};
const CLOSERS: Readonly<Record<string, string>> = {
  ")": "(",
  "]": "[",
  "}": "{",
};

const charAt = (
  lines: ReadonlyArray<string>,
  at: VimPosition
): string | undefined => (lines[at.line] ?? "")[at.character];

/** The next position after `at`, or null at the end of the document. */
const forward = (
  lines: ReadonlyArray<string>,
  at: VimPosition
): VimPosition | null => {
  if (at.character + 1 < (lines[at.line] ?? "").length) {
    return { line: at.line, character: at.character + 1 };
  }
  for (let line = at.line + 1; line < lines.length; line++) {
    if ((lines[line] ?? "").length > 0) return { line, character: 0 };
  }
  return null;
};

/** The previous position before `at`, or null at the start of the document. */
const backward = (
  lines: ReadonlyArray<string>,
  at: VimPosition
): VimPosition | null => {
  if (at.character > 0) return { line: at.line, character: at.character - 1 };
  for (let line = at.line - 1; line >= 0; line--) {
    const length = (lines[line] ?? "").length;
    if (length > 0) return { line, character: length - 1 };
  }
  return null;
};

/** Scan for the partner of the bracket at `from`, counting nesting on the way. */
function partnerOf(
  lines: ReadonlyArray<string>,
  from: VimPosition,
  open: string,
  close: string,
  ahead: boolean
): VimPosition | null {
  const step = ahead ? forward : backward;
  let depth = 0;
  let at: VimPosition | null = from;
  while (at !== null) {
    const character = charAt(lines, at);
    if (character === open) depth += ahead ? 1 : -1;
    else if (character === close) depth += ahead ? -1 : 1;
    if (depth === 0) return at;
    at = step(lines, at);
  }
  return null;
}

/**
 * `%` — the bracket matching the one at or after the caret on its line.
 *
 * Vim looks ahead along the line first, so `%` works from anywhere on
 * `if (x) {` rather than only from a bracket itself. Null when the line carries
 * no bracket, or when the one it carries is unbalanced.
 */
export function matchingBracket(
  lines: ReadonlyArray<string>,
  caret: VimPosition
): VimPosition | null {
  const text = lines[caret.line] ?? "";
  for (let column = caret.character; column < text.length; column++) {
    const character = text[column] ?? "";
    const at = { line: caret.line, character: column };
    const closer = PAIRS[character];
    if (closer !== undefined) {
      return partnerOf(lines, at, character, closer, true);
    }
    const opener = CLOSERS[character];
    if (opener !== undefined) {
      return partnerOf(lines, at, opener, character, false);
    }
  }
  return null;
}

/**
 * `[{`, `[(`, `]}`, `])` — the wall of the block the caret is inside.
 *
 * Unlike `%` this starts from a caret that is not on a bracket at all, which is
 * the point: it is how you get from the middle of a function body to its brace.
 */
export function enclosingBracket(
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  open: string,
  ahead: boolean,
  count: number
): VimPosition | null {
  const close = PAIRS[open];
  if (close === undefined) return null;
  const step = ahead ? forward : backward;
  let at: VimPosition | null = caret;
  let found: VimPosition | null = null;

  for (let n = 0; n < count; n++) {
    // Start just outside the bracket found last time, so a repeat climbs a
    // level rather than finding the same wall again.
    at = step(lines, at ?? caret);
    let depth = 0;
    while (at !== null) {
      const character = charAt(lines, at);
      // Going out: the closer of the level we are in pushes us one deeper.
      const inward = ahead ? open : close;
      const outward = ahead ? close : open;
      if (character === inward) depth += 1;
      else if (character === outward) {
        if (depth === 0) break;
        depth -= 1;
      }
      at = step(lines, at);
    }
    if (at === null) return found;
    found = at;
  }
  return found;
}

const isBlank = (text: string | undefined): boolean =>
  text === undefined || text.trim().length === 0;

/**
 * `{` and `}` — the blank line that ends the run of code the caret is in.
 *
 * The plainest way there is of stepping through a file a block at a time, and
 * the one that works in a language whose blocks are not brackets at all.
 */
export function paragraphJump(
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  ahead: boolean,
  count: number
): VimPosition {
  const step = ahead ? 1 : -1;
  const inFile = (line: number) => line >= 0 && line < lines.length;
  let line = caret.line;

  for (let n = 0; n < count; n++) {
    let next = line + step;
    // Standing in a run of blanks, leave it first — otherwise the motion would
    // land on the blank it is already on and never go anywhere.
    if (isBlank(lines[line])) {
      while (inFile(next) && isBlank(lines[next])) next += step;
    }
    while (inFile(next) && !isBlank(lines[next])) next += step;
    line = Math.max(0, Math.min(next, lines.length - 1));
  }
  return { line, character: 0 };
}

/**
 * `[[` and `]]` — the next thing that starts at the left margin.
 *
 * Vim looks for a `{` in column one; in a file of exported functions and
 * classes, "a line with code on it that is not indented" is the same answer and
 * survives a brace style that puts the brace on the header line.
 */
export function sectionJump(
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  ahead: boolean,
  count: number
): VimPosition {
  const starts = (text: string | undefined): boolean =>
    text !== undefined &&
    text.trim().length > 0 &&
    text[0] !== " " &&
    text[0] !== "\t";

  let line = caret.line;
  for (let n = 0; n < count; n++) {
    let next = line + (ahead ? 1 : -1);
    while (next > 0 && next < lines.length - 1 && !starts(lines[next])) {
      next += ahead ? 1 : -1;
    }
    line = Math.max(0, Math.min(next, lines.length - 1));
  }
  return { line, character: 0 };
}
