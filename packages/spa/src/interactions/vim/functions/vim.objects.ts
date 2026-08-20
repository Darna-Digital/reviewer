/**
 * Text objects — `iw`, `a"`, `i{` and the rest.
 *
 * A motion says where to go; a text object says what a thing *is*, so the caret
 * can be anywhere inside it. That is the difference between `dw`, which deletes
 * from here to the next word, and `diw`, which deletes the word you are on
 * wherever in it you happen to be standing — and it is why `viw` is the way
 * most people select a word at all.
 *
 * Every object resolves to a half-open range, `[start, end)`, so an operator can
 * take it straight to `operateOnRange` and a visual selection can put its caret
 * on the last character inside it.
 *
 * Pairs and quotes are found by counting characters, like `%` — a brace inside a
 * string is counted, which is the same place Vim's own is wrong without a
 * filetype plugin.
 */
import type { VimPosition } from "../interfaces/vim.interfaces";
import { enclosingBracket } from "./vim.brackets";

/** What `i` / `a` was applied to. */
export type VimTextObject =
  | { readonly kind: "word"; readonly big: boolean }
  | { readonly kind: "paragraph" }
  /** `( [ { <` and their closers, plus Vim's `b` and `B` spellings. */
  | { readonly kind: "pair"; readonly open: string }
  | { readonly kind: "quote"; readonly char: string };

/** A half-open span of the document: `end` is one past the last character. */
export interface VimSpan {
  readonly start: VimPosition;
  readonly end: VimPosition;
}

/** The object each key names, or undefined when the key names none. */
export const OBJECT_KEYS: Readonly<Record<string, VimTextObject>> = {
  w: { kind: "word", big: false },
  W: { kind: "word", big: true },
  p: { kind: "paragraph" },
  "(": { kind: "pair", open: "(" },
  ")": { kind: "pair", open: "(" },
  b: { kind: "pair", open: "(" },
  "{": { kind: "pair", open: "{" },
  "}": { kind: "pair", open: "{" },
  B: { kind: "pair", open: "{" },
  "[": { kind: "pair", open: "[" },
  "]": { kind: "pair", open: "[" },
  "<": { kind: "pair", open: "<" },
  ">": { kind: "pair", open: "<" },
  '"': { kind: "quote", char: '"' },
  "'": { kind: "quote", char: "'" },
  "`": { kind: "quote", char: "`" },
};

const WORD = /[\p{L}\p{N}_]/u;

const classOf = (character: string | undefined, big: boolean): string => {
  if (character === undefined) return "none";
  if (/\s/.test(character)) return "blank";
  if (big) return "word";
  return WORD.test(character) ? "word" : "punct";
};

/** `iw` / `aw` — the run under the caret, and for `aw` the space after it. */
function wordSpan(
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  big: boolean,
  around: boolean
): VimSpan | null {
  const text = lines[caret.line] ?? "";
  if (text.length === 0) return null;
  const at = Math.min(caret.character, text.length - 1);
  const run = classOf(text[at], big);
  if (run === "none") return null;

  let start = at;
  while (start > 0 && classOf(text[start - 1], big) === run) start -= 1;
  let end = at + 1;
  while (end < text.length && classOf(text[end], big) === run) end += 1;

  if (around) {
    // `aw` takes the whitespace after the word, or before it when the word ends
    // the line — so deleting one word out of a list leaves no double space.
    const afterStart = end;
    while (end < text.length && classOf(text[end], big) === "blank") end += 1;
    if (end === afterStart) {
      while (start > 0 && classOf(text[start - 1], big) === "blank") start -= 1;
    }
  }
  return {
    start: { line: caret.line, character: start },
    end: { line: caret.line, character: end },
  };
}

const isBlank = (text: string | undefined): boolean =>
  text === undefined || text.trim().length === 0;

/** `ip` / `ap` — the run of lines around the caret, blank or not. */
function paragraphSpan(
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  around: boolean
): VimSpan | null {
  const blank = isBlank(lines[caret.line]);
  let top = caret.line;
  let bottom = caret.line;
  while (top > 0 && isBlank(lines[top - 1]) === blank) top -= 1;
  while (bottom + 1 < lines.length && isBlank(lines[bottom + 1]) === blank) {
    bottom += 1;
  }
  if (around) {
    while (bottom + 1 < lines.length && isBlank(lines[bottom + 1]) !== blank) {
      bottom += 1;
    }
  }
  return {
    start: { line: top, character: 0 },
    end: {
      line: bottom,
      character: (lines[bottom] ?? "").length,
    },
  };
}

/** `i(` / `a{` — between the walls of the enclosing pair, or including them. */
function pairSpan(
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  open: string,
  around: boolean
): VimSpan | null {
  const before = enclosingBracket(lines, caret, open, false, 1);
  const after = enclosingBracket(lines, caret, open, true, 1);
  if (before === null || after === null) return null;
  if (around) {
    return {
      start: before,
      end: { line: after.line, character: after.character + 1 },
    };
  }
  return {
    start: { line: before.line, character: before.character + 1 },
    end: after,
  };
}

/**
 * `i"` / `a'` — between the quotes on the caret's line.
 *
 * Quotes are paired left to right across the line, as Vim does: the caret is
 * either inside one of those pairs or before one, and `ci"` from the start of
 * the line reaching the first string is the behaviour people rely on.
 */
function quoteSpan(
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  char: string,
  around: boolean
): VimSpan | null {
  const text = lines[caret.line] ?? "";
  const marks: Array<number> = [];
  for (let at = 0; at < text.length; at++) {
    if (text[at] === char && text[at - 1] !== "\\") marks.push(at);
  }
  for (let pair = 0; pair + 1 < marks.length; pair += 2) {
    const open = marks[pair];
    const close = marks[pair + 1];
    if (caret.character > close) continue;
    const [start, end] = around ? [open, close + 1] : [open + 1, close];
    return {
      start: { line: caret.line, character: start },
      end: { line: caret.line, character: end },
    };
  }
  return null;
}

/** Where `object` reaches from the caret, or null when there is no such thing. */
export function textObjectSpan(
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  object: VimTextObject,
  around: boolean
): VimSpan | null {
  switch (object.kind) {
    case "word":
      return wordSpan(lines, caret, object.big, around);
    case "paragraph":
      return paragraphSpan(lines, caret, around);
    case "pair":
      return pairSpan(lines, caret, object.open, around);
    case "quote":
      return quoteSpan(lines, caret, object.char, around);
  }
}

/** Whether an object covers whole lines, which an operator takes linewise. */
export const isLinewiseObject = (object: VimTextObject): boolean =>
  object.kind === "paragraph";
