/**
 * Task-list editing for every box the app is typed into — the session composer,
 * a review comment, a note taken on the page in the browser pane: continuing a
 * list on the newline key and re-nesting it with Tab. Sub-items are numbered
 * under their parent (2 → 2.1), and every structural edit renumbers the
 * surrounding block, so a list stays in order no matter where items were
 * inserted or how they were re-nested.
 *
 * Pure text in, pure text out. `hooks/use-list-editing` is what wires it to a
 * textarea; which key counts as the newline is the composer's own business, so
 * it is not decided here.
 */

export interface ComposerSelection {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

const INDENT = "  ";

/**
 * An ordered marker needs a trailing dot ("2.") or a dotted path ("2.1"), so a
 * line opening with a bare year ("2024 was…") stays prose.
 */
const ITEM =
  /^( *)(?:([-*+])|(?:\d+(?:\.\d+)+\.?|\d+\.))[ \t]+(?:(\[[ xX]\])[ \t]+)?(.*)$/;

interface Item {
  depth: number;
  bullet: string | null;
  checkbox: string | null;
  content: string;
  prefixLength: number;
}

function parseItem(line: string | undefined): Item | null {
  const match = ITEM.exec(line ?? "");
  if (match === null) return null;
  const spaces = match[1] ?? "";
  const content = match[4] ?? "";
  return {
    depth: Math.floor(spaces.length / INDENT.length),
    bullet: match[2] ?? null,
    checkbox: match[3] ?? null,
    content,
    prefixLength: (line ?? "").length - content.length,
  };
}

function formatItem(item: Item, numbers: ReadonlyArray<number>): string {
  const marker =
    item.bullet ??
    (numbers.length === 1 ? `${numbers[0]}.` : numbers.join("."));
  const checkbox = item.checkbox === null ? "" : `${item.checkbox} `;
  return `${INDENT.repeat(item.depth)}${marker} ${checkbox}${item.content}`;
}

/** The run of consecutive list lines around `anchor`. */
function blockRange(
  lines: ReadonlyArray<string>,
  anchor: number
): [number, number] {
  let from = anchor;
  let to = anchor;
  while (from > 0 && parseItem(lines[from - 1]) !== null) from -= 1;
  while (to + 1 < lines.length && parseItem(lines[to + 1]) !== null) to += 1;
  return [from, to];
}

function renumberBlock(lines: ReadonlyArray<string>, anchor: number): string[] {
  const next = [...lines];
  const [from, to] = blockRange(next, anchor);
  const counters: number[] = [];
  for (let i = from; i <= to; i += 1) {
    const item = parseItem(next[i]);
    if (item === null) continue;
    if (item.bullet !== null) {
      counters.length = Math.min(counters.length, item.depth + 1);
      next[i] = formatItem(item, []);
      continue;
    }
    counters.length = item.depth + 1;
    for (let d = 0; d < item.depth; d += 1) counters[d] ??= 1;
    counters[item.depth] = (counters[item.depth] ?? 0) + 1;
    next[i] = formatItem(item, counters);
  }
  return next;
}

function locate(
  lines: ReadonlyArray<string>,
  position: number
): { line: number; column: number } {
  let remaining = position;
  for (let i = 0; i < lines.length; i += 1) {
    const length = (lines[i] ?? "").length;
    if (remaining <= length) return { line: i, column: remaining };
    remaining -= length + 1;
  }
  const last = lines.length - 1;
  return { line: last, column: (lines[last] ?? "").length };
}

/** Absolute offset of `contentOffset` characters into a line's content. */
function positionOf(
  lines: ReadonlyArray<string>,
  line: number,
  contentOffset: number
): number {
  let start = 0;
  for (let i = 0; i < line; i += 1) start += (lines[i] ?? "").length + 1;
  const raw = lines[line] ?? "";
  const prefix = parseItem(raw)?.prefixLength ?? 0;
  return start + Math.min(prefix + contentOffset, raw.length);
}

function contentOffsetAt(
  lines: ReadonlyArray<string>,
  line: number,
  column: number
): number {
  const prefix = parseItem(lines[line])?.prefixLength ?? 0;
  return Math.max(0, column - prefix);
}

function caretAt(
  lines: ReadonlyArray<string>,
  line: number,
  contentOffset: number
): ComposerSelection {
  const position = positionOf(lines, line, contentOffset);
  return {
    text: lines.join("\n"),
    selectionStart: position,
    selectionEnd: position,
  };
}

/**
 * The span of `before` that `after` rewrites, as `[start, end, replacement]`.
 * Rewriting only that span lets the edit go through the browser's own text
 * insertion, which keeps undo working.
 */
export function changedRange(
  before: string,
  after: string
): [number, number, string] {
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  ) {
    start += 1;
  }
  let tail = 0;
  while (
    tail < before.length - start &&
    tail < after.length - start &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail += 1;
  }
  return [start, before.length - tail, after.slice(start, after.length - tail)];
}

/**
 * Newline inside a list: open the next item at the same depth, or close the
 * list when the current item is still empty. Returns null when the caret is not
 * in a list and the newline should be inserted as usual.
 */
export function continueList(
  input: ComposerSelection
): ComposerSelection | null {
  const text =
    input.text.slice(0, input.selectionStart) +
    input.text.slice(input.selectionEnd);
  const lines = text.split("\n");
  const { line, column } = locate(lines, input.selectionStart);
  const item = parseItem(lines[line]);
  if (item === null) return null;

  if (item.content.length === 0) {
    if (item.depth === 0) {
      lines[line] = "";
      return caretAt(lines, line, 0);
    }
    lines[line] = formatItem({ ...item, depth: item.depth - 1 }, [1]);
    return caretAt(renumberBlock(lines, line), line, 0);
  }

  const split = contentOffsetAt(lines, line, column);
  lines[line] = formatItem(
    { ...item, content: item.content.slice(0, split) },
    [1]
  );
  lines.splice(
    line + 1,
    0,
    formatItem(
      {
        ...item,
        content: item.content.slice(split),
        checkbox: item.checkbox === null ? null : "[ ]",
      },
      [1]
    )
  );
  return caretAt(renumberBlock(lines, line + 1), line + 1, 0);
}

/**
 * Tab / Shift+Tab on list lines. An item can only nest one level under the item
 * above it. Returns null when nothing in the selection can move, leaving Tab to
 * do what it normally does.
 */
export function shiftListIndent(
  input: ComposerSelection,
  levels: 1 | -1
): ComposerSelection | null {
  const original = input.text.split("\n");
  const lines = [...original];
  const start = locate(original, input.selectionStart);
  const end = locate(original, input.selectionEnd);
  const lastLine =
    end.line > start.line && end.column === 0 ? end.line - 1 : end.line;

  let changed = false;
  for (let i = start.line; i <= lastLine; i += 1) {
    const item = parseItem(lines[i]);
    if (item === null) continue;
    const above = parseItem(lines[i - 1]);
    const maxDepth = above === null ? 0 : above.depth + 1;
    const depth = Math.min(Math.max(item.depth + levels, 0), maxDepth);
    if (depth === item.depth) continue;
    lines[i] = formatItem({ ...item, depth }, [1]);
    changed = true;
  }
  if (!changed) return null;

  let next = lines;
  for (let i = start.line; i <= lastLine; i += 1) next = renumberBlock(next, i);

  return {
    text: next.join("\n"),
    selectionStart: positionOf(
      next,
      start.line,
      contentOffsetAt(original, start.line, start.column)
    ),
    selectionEnd: positionOf(
      next,
      end.line,
      contentOffsetAt(original, end.line, end.column)
    ),
  };
}
