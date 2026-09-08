/**
 * Where a motion lands.
 *
 * Every motion is a pure function of the lines, the caret and a count, which is
 * what lets the whole grammar be tested without an editor. Vim's own conventions
 * are kept where they are load-bearing: the caret sits *on* a character in
 * normal mode rather than between two, so the last column of a line is its last
 * character and not the position after it; and a motion that cannot go any
 * further stops rather than wrapping.
 */
import type { VimMotion, VimPosition } from "../interfaces/vim.interfaces";
import {
  enclosingBracket,
  matchingBracket,
  paragraphJump,
  sectionJump,
} from "./vim.brackets";

/** How far `⌃d` and `⌃u` travel, as Vim's default half-page. */
export const HALF_PAGE_LINES = 12;

const WORD = /[\p{L}\p{N}_]/u;

type CharClass = "word" | "punct" | "blank";

const classOf = (character: string | undefined): CharClass => {
  if (character === undefined || /\s/.test(character)) return "blank";
  return WORD.test(character) ? "word" : "punct";
};

/** A big word (`W`, `B`, `E`) is anything that is not whitespace. */
const bigClassOf = (character: string | undefined): CharClass =>
  classOf(character) === "blank" ? "blank" : "word";

const clampLine = (lines: ReadonlyArray<string>, line: number): number =>
  Math.max(0, Math.min(line, lines.length - 1));

/**
 * The last column the caret may sit on.
 *
 * In normal mode that is the line's last character; while typing, and for the
 * end of an operator's range, it is the position past it.
 */
export const lastColumn = (text: string, past: boolean): number =>
  past ? text.length : Math.max(0, text.length - 1);

export const clampCaret = (
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  past: boolean
): VimPosition => {
  const line = clampLine(lines, caret.line);
  const text = lines[line] ?? "";
  return {
    line,
    character: Math.max(0, Math.min(caret.character, lastColumn(text, past))),
  };
};

/** The column of the first non-blank character, or 0 on a blank line. */
export const firstNonBlank = (text: string): number => {
  const indent = text.length - text.trimStart().length;
  return indent >= text.length ? 0 : indent;
};

/** Caret as a flat offset into the joined document, and back again. */
const toOffset = (lines: ReadonlyArray<string>, caret: VimPosition): number => {
  let offset = 0;
  for (let n = 0; n < caret.line; n++) offset += (lines[n] ?? "").length + 1;
  return offset + caret.character;
};

const toPosition = (
  lines: ReadonlyArray<string>,
  offset: number
): VimPosition => {
  let left = offset;
  for (let line = 0; line < lines.length; line++) {
    const length = (lines[line] ?? "").length;
    if (left <= length) return { line, character: left };
    left -= length + 1;
  }
  const line = Math.max(0, lines.length - 1);
  return { line, character: (lines[line] ?? "").length };
};

const documentText = (lines: ReadonlyArray<string>) => lines.join("\n");

/**
 * Whether `at` is the start of an empty line.
 *
 * Vim counts one as a word of its own, which is what stops `w` running a whole
 * blank stanza together and what makes `dw` on the line above stop at it.
 */
const startsEmptyLine = (text: string, at: number): boolean =>
  at > 0 && text[at - 1] === "\n" && (at >= text.length || text[at] === "\n");

/** One `w`: past the current run, then past any blanks. */
const wordForwardOnce = (
  lines: ReadonlyArray<string>,
  from: VimPosition,
  big: boolean
): VimPosition => {
  const text = documentText(lines);
  const klass = big ? bigClassOf : classOf;
  let at = toOffset(lines, from);
  const end = text.length;
  if (at >= end) return from;
  const start = klass(text[at]);
  if (start !== "blank") {
    while (at < end && klass(text[at]) === start && text[at] !== "\n") at += 1;
  }
  while (at < end && (klass(text[at]) === "blank" || text[at] === "\n")) {
    at += 1;
    if (startsEmptyLine(text, at)) break;
  }
  return toPosition(lines, Math.min(at, end));
};

/** One `b`: back over blanks, then back over the run that ends there. */
const wordBackOnce = (
  lines: ReadonlyArray<string>,
  from: VimPosition,
  big: boolean
): VimPosition => {
  const text = documentText(lines);
  const klass = big ? bigClassOf : classOf;
  let at = toOffset(lines, from);
  if (at <= 0) return { line: 0, character: 0 };
  at -= 1;
  while (at > 0 && (klass(text[at]) === "blank" || text[at] === "\n")) {
    if (startsEmptyLine(text, at)) return toPosition(lines, at);
    at -= 1;
  }
  const run = klass(text[at]);
  if (run === "blank") return toPosition(lines, 0);
  while (at > 0 && klass(text[at - 1]) === run && text[at - 1] !== "\n")
    at -= 1;
  return toPosition(lines, at);
};

/** One `e`: on to the last character of the word ahead. */
const wordEndOnce = (
  lines: ReadonlyArray<string>,
  from: VimPosition,
  big: boolean
): VimPosition => {
  const text = documentText(lines);
  const klass = big ? bigClassOf : classOf;
  const end = text.length;
  let at = toOffset(lines, from);
  if (at >= end - 1) return from;
  at += 1;
  while (at < end && (klass(text[at]) === "blank" || text[at] === "\n"))
    at += 1;
  if (at >= end) return toPosition(lines, end - 1);
  const run = klass(text[at]);
  while (at + 1 < end && klass(text[at + 1]) === run && text[at + 1] !== "\n") {
    at += 1;
  }
  return toPosition(lines, at);
};

/**
 * `f` / `t` and their capitals, which never leave the caret's own line.
 *
 * The count picks the occurrence, and `till` only steps off it once that
 * occurrence has been found — searching from a column short of the caret would
 * make `2t,` land on the first comma rather than the second, and `dt,` eat the
 * comma when it is the very next character.
 */
const findCharTarget = (
  text: string,
  from: number,
  char: string,
  forward: boolean,
  till: boolean,
  count: number
): number | null => {
  let at = from;
  for (let n = 0; n < count; n++) {
    const found = forward
      ? text.indexOf(char, at + 1)
      : at <= 0
        ? -1
        : text.lastIndexOf(char, at - 1);
    if (found === -1) return null;
    at = found;
  }
  return till ? (forward ? at - 1 : at + 1) : at;
};

/**
 * Where `motion` lands, or null when it cannot be made at all — a `f` that
 * finds nothing, a `%` over an unbalanced bracket, a `j` on the last line.
 *
 * A plain move treats that as "stay put" (see `applyMotion`), but an operator
 * has to abandon the whole command: `dfZ` where there is no Z deletes nothing,
 * rather than falling back on a zero-width range that still takes a character
 * with it.
 *
 * `past` says whether the caret may sit after a line's last character — true
 * while inserting, and for the end of the range an operator works on.
 */
export function motionTarget(
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  motion: VimMotion,
  count: number,
  past: boolean
): VimPosition | null {
  const at = clampCaret(lines, caret, past);
  const text = lines[at.line] ?? "";

  switch (motion.kind) {
    case "left":
      return { line: at.line, character: Math.max(0, at.character - count) };
    case "right":
      return {
        line: at.line,
        character: Math.min(lastColumn(text, past), at.character + count),
      };
    case "up":
    case "down": {
      const wanted = at.line + (motion.kind === "down" ? count : -count);
      // Off the end of the file: as a move this stops at the last line, but as
      // an operator's motion it is a failure — `dj` on the last line takes
      // nothing with it, rather than quietly deleting the line it is on.
      if (wanted < 0 || wanted > lines.length - 1) return null;
      // Vim keeps the column it was aiming for; this keeps the simpler promise
      // of never landing past the end of the line it arrives on.
      return {
        line: wanted,
        character: Math.min(
          at.character,
          lastColumn(lines[wanted] ?? "", past)
        ),
      };
    }
    case "halfPageDown":
    case "halfPageUp": {
      const step = HALF_PAGE_LINES * count;
      const line = clampLine(
        lines,
        at.line + (motion.kind === "halfPageDown" ? step : -step)
      );
      return {
        line,
        character: Math.min(at.character, lastColumn(lines[line] ?? "", past)),
      };
    }
    case "wordForward": {
      let out = at;
      for (let n = 0; n < count; n++)
        out = wordForwardOnce(lines, out, motion.big);
      return clampCaret(lines, out, past);
    }
    case "wordBack": {
      let out = at;
      for (let n = 0; n < count; n++)
        out = wordBackOnce(lines, out, motion.big);
      return clampCaret(lines, out, past);
    }
    case "wordEnd": {
      let out = at;
      for (let n = 0; n < count; n++) out = wordEndOnce(lines, out, motion.big);
      return clampCaret(lines, out, past);
    }
    case "lineStart":
      return { line: at.line, character: 0 };
    case "firstNonBlank":
      return { line: at.line, character: firstNonBlank(text) };
    case "lineEnd":
      return { line: at.line, character: lastColumn(text, past) };
    case "fileStart":
      return { line: 0, character: firstNonBlank(lines[0] ?? "") };
    case "fileEnd": {
      const line = clampLine(lines, lines.length - 1);
      return { line, character: firstNonBlank(lines[line] ?? "") };
    }
    case "goToLine": {
      const line = clampLine(lines, motion.line);
      return { line, character: firstNonBlank(lines[line] ?? "") };
    }
    case "matchBracket": {
      // Unbalanced, or no bracket on the line: Vim beeps and stays put.
      const found = matchingBracket(lines, at);
      return found === null ? null : clampCaret(lines, found, past);
    }
    case "enclosing": {
      const found = enclosingBracket(
        lines,
        at,
        motion.open,
        motion.ahead,
        count
      );
      return found === null ? null : clampCaret(lines, found, past);
    }
    case "paragraph":
      return clampCaret(
        lines,
        paragraphJump(lines, at, motion.ahead, count),
        past
      );
    case "section":
      return clampCaret(
        lines,
        sectionJump(lines, at, motion.ahead, count),
        past
      );
    case "findChar": {
      const column = findCharTarget(
        text,
        at.character,
        motion.char,
        motion.forward,
        motion.till,
        count
      );
      // A search that fails leaves the caret exactly where it was, as in Vim.
      return column === null ? null : { line: at.line, character: column };
    }
  }
}

/**
 * Where `motion` lands, with a motion that cannot be made leaving the caret
 * where it is — which is what a plain move does, and what `applyMotion`'s
 * callers have always been written against.
 */
export function applyMotion(
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  motion: VimMotion,
  count: number,
  past: boolean
): VimPosition {
  return (
    motionTarget(lines, caret, motion, count, past) ??
    clampCaret(lines, caret, past)
  );
}

/**
 * Where an operator's `w` stops.
 *
 * Vim's own special case: when the last word moved over ends a line, the
 * operated text ends there too rather than running on into the first word of
 * the next line — `dw` on the last word of a line does not join the two.
 * Starting on whitespace there is no word being moved over, so the ordinary
 * motion stands and `dw` on a line's trailing spaces still joins.
 */
export function wordOperatorEnd(
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  count: number,
  big: boolean
): VimPosition {
  let at = clampCaret(lines, caret, true);
  for (let n = 0; n < count; n++) {
    const onWord = classOf((lines[at.line] ?? "")[at.character]) !== "blank";
    const next = wordForwardOnce(lines, at, big);
    if (onWord && next.line > at.line) {
      return { line: at.line, character: (lines[at.line] ?? "").length };
    }
    if (next.line === at.line && next.character === at.character) break;
    at = next;
  }
  return clampCaret(lines, at, true);
}

/** Whether a motion covers whole lines, which is what an operator acts on. */
export const isLinewise = (motion: VimMotion): boolean =>
  motion.kind === "up" ||
  motion.kind === "section" ||
  motion.kind === "down" ||
  motion.kind === "fileStart" ||
  motion.kind === "fileEnd" ||
  motion.kind === "goToLine" ||
  motion.kind === "halfPageDown" ||
  motion.kind === "halfPageUp";

/**
 * Whether a motion's landing place is included in the range an operator takes.
 *
 * `dw` stops before the character it moved onto; `de` and `df,` take it. This is
 * Vim's exclusive/inclusive distinction, and getting it wrong is the difference
 * between deleting a word and deleting a word and a letter.
 */
export const isInclusive = (motion: VimMotion): boolean =>
  motion.kind === "wordEnd" ||
  // `d%` takes the bracket it lands on, and so does `d]}` — the point of both
  // is to remove the whole balanced run rather than to leave a stray wall.
  motion.kind === "matchBracket" ||
  (motion.kind === "enclosing" && motion.ahead) ||
  (motion.kind === "findChar" && motion.forward) ||
  motion.kind === "lineEnd";
