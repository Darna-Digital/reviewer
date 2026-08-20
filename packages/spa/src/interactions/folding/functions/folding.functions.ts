/**
 * Which parts of a file can be folded away, and which of them are.
 *
 * Regions are worked out from indentation: a line that is followed by more
 * deeply indented lines opens a region that runs to the last of them. That is
 * the fallback every editor keeps for a language it has no parser for, and it
 * is enough on its own — it folds K&R braces, Python, YAML, JSON, Markdown
 * lists and JSX alike, without a round trip to a language server and without a
 * grammar per filetype.
 *
 * What it does not fold is a brace on a line of its own (Allman style), where
 * the header line is no less indented than the body. Handling that means
 * matching brackets, which means knowing which of them are inside strings —
 * a parser's job, and a language server's answer to give.
 *
 * Blank lines belong to whichever region surrounds them and never end one, so a
 * function with a paragraph break in the middle still folds as one thing.
 */

export interface FoldRegion {
  /** Zero-based line the fold hangs off. It stays on screen when closed. */
  readonly start: number;
  /** Zero-based last line inside the fold — hidden when closed. */
  readonly end: number;
}

/** Indentation width, or null for a line with nothing on it. */
const indentOf = (text: string | undefined): number | null => {
  if (text === undefined) return null;
  const trimmed = text.trimStart();
  return trimmed.length === 0 ? null : text.length - trimmed.length;
};

/**
 * Every region in the file, outermost first at each starting line.
 *
 * A line can only ever start one region, so the result is at most one entry per
 * line, and nesting falls out of the indentation rather than being tracked.
 */
export function foldRegions(
  lines: ReadonlyArray<string>
): ReadonlyArray<FoldRegion> {
  const regions: Array<FoldRegion> = [];
  for (let start = 0; start < lines.length; start++) {
    const indent = indentOf(lines[start]);
    if (indent === null) continue;
    let end = start;
    for (let line = start + 1; line < lines.length; line++) {
      const inner = indentOf(lines[line]);
      // A blank line is not a boundary — it is part of whatever surrounds it.
      if (inner === null) continue;
      if (inner <= indent) break;
      end = line;
    }
    if (end > start) regions.push({ start, end });
  }
  return regions;
}

/** The region that hangs off `line`, if any. */
export const regionAt = (
  regions: ReadonlyArray<FoldRegion>,
  line: number
): FoldRegion | null => regions.find((r) => r.start === line) ?? null;

/**
 * The region to act on for a caret on `line`: the one starting there, or
 * failing that the innermost one it sits inside.
 *
 * Folding from the middle of a block is the common gesture — the caret is on
 * the line you are reading, not on the header you want to collapse.
 */
export function enclosingRegion(
  regions: ReadonlyArray<FoldRegion>,
  line: number
): FoldRegion | null {
  const own = regionAt(regions, line);
  if (own !== null) return own;
  let innermost: FoldRegion | null = null;
  for (const region of regions) {
    if (region.start >= line || region.end < line) continue;
    if (innermost === null || region.start > innermost.start) {
      innermost = region;
    }
  }
  return innermost;
}

/**
 * The lines hidden by the closed folds.
 *
 * A fold closed inside another closed fold contributes nothing new, which is
 * why this is a union rather than a walk: reopening the outer one has to bring
 * back everything the inner one was not hiding, and the set is recomputed from
 * the closed starts every time rather than maintained.
 */
export function hiddenLines(
  regions: ReadonlyArray<FoldRegion>,
  closed: ReadonlySet<number>
): ReadonlySet<number> {
  const hidden = new Set<number>();
  for (const region of regions) {
    if (!closed.has(region.start)) continue;
    for (let line = region.start + 1; line <= region.end; line++) {
      hidden.add(line);
    }
  }
  return hidden;
}

/** Close the region at (or around) `line`, or open it when it is already closed. */
export function toggleFold(
  regions: ReadonlyArray<FoldRegion>,
  closed: ReadonlySet<number>,
  line: number
): ReadonlySet<number> {
  const region = enclosingRegion(regions, line);
  if (region === null) return closed;
  const next = new Set(closed);
  if (next.has(region.start)) next.delete(region.start);
  else next.add(region.start);
  return next;
}

/** Close the region at (or around) `line`; `zc`, and ⌘⌥[. */
export function closeFold(
  regions: ReadonlyArray<FoldRegion>,
  closed: ReadonlySet<number>,
  line: number
): ReadonlySet<number> {
  const region = enclosingRegion(regions, line);
  if (region === null || closed.has(region.start)) return closed;
  return new Set(closed).add(region.start);
}

/**
 * Open the fold `line` is inside; `zo`, and ⌘⌥].
 *
 * A caret on a closed header opens that one. A caret on a line that is hidden
 * cannot be reached in the first place, so what this really opens is the
 * outermost closed fold covering the line — the one actually hiding it.
 */
export function openFold(
  regions: ReadonlyArray<FoldRegion>,
  closed: ReadonlySet<number>,
  line: number
): ReadonlySet<number> {
  if (closed.has(line)) {
    const next = new Set(closed);
    next.delete(line);
    return next;
  }
  let outermost: FoldRegion | null = null;
  for (const region of regions) {
    if (!closed.has(region.start)) continue;
    if (region.start > line || region.end < line) continue;
    if (outermost === null || region.start < outermost.start) {
      outermost = region;
    }
  }
  if (outermost === null) return closed;
  const next = new Set(closed);
  next.delete(outermost.start);
  return next;
}

/** Close every region; `zM`. */
export const foldAll = (
  regions: ReadonlyArray<FoldRegion>
): ReadonlySet<number> => new Set(regions.map((region) => region.start));

/** Open everything; `zR`. */
export const unfoldAll = (): ReadonlySet<number> => new Set<number>();

/**
 * The closed folds that still make sense against a changed file.
 *
 * Editing moves lines around, and a fold is remembered by the line its header
 * is on. Rather than trying to follow a header as it slides, a fold that is no
 * longer a region's start is simply dropped — a fold that quietly moved onto
 * the wrong block would be worse than one that opened.
 */
export const survivingFolds = (
  regions: ReadonlyArray<FoldRegion>,
  closed: ReadonlySet<number>
): ReadonlySet<number> => {
  const starts = new Set(regions.map((region) => region.start));
  const next = new Set<number>();
  for (const line of closed) if (starts.has(line)) next.add(line);
  return next;
};

/**
 * The line a caret on `line` belongs on once the folds are closed: the header
 * of the fold hiding it, so the caret is never somewhere invisible.
 */
export function visibleLine(
  hidden: ReadonlySet<number>,
  regions: ReadonlyArray<FoldRegion>,
  closed: ReadonlySet<number>,
  line: number
): number {
  if (!hidden.has(line)) return line;
  let header = line;
  for (const region of regions) {
    if (!closed.has(region.start)) continue;
    if (region.start < line && region.end >= line && region.start < header) {
      header = region.start;
    }
  }
  return header === line ? line : header;
}

/**
 * The nearest line at or beyond `line` that is not hidden, walking in
 * `direction`. Undefined when everything that way is folded away.
 *
 * This is what keeps the caret out of a closed fold: the editor asks for it on
 * every vertical move, so ↓ steps over a folded block in one go instead of
 * disappearing into it.
 */
export function nearestVisible(
  hidden: ReadonlySet<number>,
  line: number,
  direction: "up" | "down",
  total: number
): number | undefined {
  const step = direction === "down" ? 1 : -1;
  for (let at = line; at >= 0 && at < total; at += step) {
    if (!hidden.has(at)) return at;
  }
  return undefined;
}
