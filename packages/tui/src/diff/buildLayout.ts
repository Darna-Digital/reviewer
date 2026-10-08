import type { ReviewComment } from '@reviewer/core/comments';
import { wrapPoints, wrapProse } from '../text/measure';
import type { DiffLine, FileDiff } from './parseDiff';

/** `file` shows one file's lines with no diff chrome — the browse viewer. */
export type ViewMode = 'unified' | 'split' | 'file';
export type Side = ReviewComment['side'];

/** One side of a split row. */
export interface Cell {
  line: number;
  start: number;
  end: number;
}

export type Row =
  | { kind: 'spacer' }
  | { kind: 'file'; file: number }
  | { kind: 'hunk'; file: number; hunk: number }
  | {
      kind: 'code';
      file: number;
      hunk: number;
      line: number;
      start: number;
      end: number;
      first: boolean;
    }
  | {
      kind: 'split';
      file: number;
      hunk: number;
      left: Cell | null;
      right: Cell | null;
      first: boolean;
    }
  | {
      kind: 'comment';
      file: number;
      comment: ReviewComment;
      part: 'head' | 'body' | 'foot';
      text: string;
      /** The line it was left on is no longer in the diff. */
      outdated: boolean;
    }
  | { kind: 'note'; file: number; text: string };

export interface Anchor {
  filePath: string;
  side: Side;
  lineNumber: number;
}

export type StopTarget =
  | { kind: 'file' }
  | { kind: 'line'; hunk: number; left: number | null; right: number | null }
  | { kind: 'comment'; comment: ReviewComment };

/** A place the cursor can rest: a line, a card or a file header. */
export interface Stop {
  row: number;
  height: number;
  file: number;
  /** Survives reloads — the cursor is restored by it. */
  key: string;
  target: StopTarget;
}

export interface Geometry {
  numberWidth: number;
  /** Cells before code starts (per side in split view). */
  gutter: number;
  /** Cells of code per row (per side in split view). */
  codeWidth: number;
  /** Width of one half in split view; the full width in unified. */
  half: number;
}

export interface Layout {
  rows: Row[];
  stops: Stop[];
  /** Header row of each file, by file index. */
  fileRows: number[];
  geometry: Geometry;
}

export interface LayoutOptions {
  files: FileDiff[];
  /** Only the comments left on the change being shown. */
  comments: ReviewComment[];
  width: number;
  view: ViewMode;
  wrap: boolean;
  collapsed: ReadonlySet<string>;
  showComments: boolean;
}

export const MAX_CARD_WIDTH = 96;
const MIN_NUMBER_WIDTH = 3;

export const stopKey = {
  file: (path: string) => `F:${path}`,
  line: (path: string, line: DiffLine) =>
    `L:${path}:${line.oldNo ?? '-'}:${line.newNo ?? '-'}`,
  comment: (id: string) => `C:${id}`,
  /** A line of a whole file, where old and new numbers are the same. */
  fileLine: (path: string, line: number) => `L:${path}:${line}:${line}`,
};

/**
 * Flattens a diff into one-cell-high rows for a virtualized pane, threading
 * comment cards under their lines, and lists the cursor stops.
 */
export function buildLayout(opts: LayoutOptions): Layout {
  const { files, width, view, wrap, collapsed, showComments } = opts;
  const geometry = geometryFor(files, width, view);
  const rows: Row[] = [];
  const stops: Stop[] = [];
  const fileRows: number[] = [];
  const byFile = groupBy(opts.comments, (comment) => comment.filePath);
  const cardInner =
    cardWidth(geometry, view === 'unified' ? width : geometry.half) - 4;

  files.forEach((file, f) => {
    fileRows.push(rows.length);
    if (view !== 'file') {
      if (f > 0) rows.push({ kind: 'spacer' });
      fileRows[f] = rows.length;
      pushStop(rows.length, 1, f, stopKey.file(file.path), { kind: 'file' });
      rows.push({ kind: 'file', file: f });
    }

    const fileComments = showComments ? (byFile.get(file.path) ?? []) : [];
    const pending = groupBy(fileComments, (c) =>
      commentKey(c.side, c.lineNumber),
    );
    const anchored = new Set(
      file.hunks.flatMap((hunk) => hunk.lines.flatMap(keysOf)),
    );
    for (const comment of fileComments) {
      if (!anchored.has(commentKey(comment.side, comment.lineNumber))) {
        pushCard(f, comment, true);
      }
    }

    if (collapsed.has(file.path)) return;
    const note = noteFor(file);
    if (note) {
      rows.push({ kind: 'note', file: f, text: note });
      return;
    }

    file.hunks.forEach((hunk, h) => {
      if (view !== 'file') rows.push({ kind: 'hunk', file: f, hunk: h });
      if (view !== 'split') {
        hunk.lines.forEach((line, l) => {
          const starts = pieces(line.text, geometry.codeWidth, wrap);
          pushStop(
            rows.length,
            starts.length,
            f,
            stopKey.line(file.path, line),
            {
              kind: 'line',
              hunk: h,
              left: l,
              right: l,
            },
          );
          starts.forEach((start, p) => {
            rows.push({
              kind: 'code',
              file: f,
              hunk: h,
              line: l,
              start,
              end: starts[p + 1] ?? line.text.length,
              first: p === 0,
            });
          });
          takeComments(pending, [line]).forEach((c) => pushCard(f, c, false));
        });
        return;
      }

      for (const [left, right] of pairLines(hunk.lines)) {
        const leftLine = left === null ? null : hunk.lines[left]!;
        const rightLine = right === null ? null : hunk.lines[right]!;
        const leftStarts = leftLine
          ? pieces(leftLine.text, geometry.codeWidth, wrap)
          : [];
        const rightStarts = rightLine
          ? pieces(rightLine.text, geometry.codeWidth, wrap)
          : [];
        const height = Math.max(leftStarts.length, rightStarts.length);
        pushStop(
          rows.length,
          height,
          f,
          stopKey.line(file.path, (rightLine ?? leftLine)!),
          {
            kind: 'line',
            hunk: h,
            left,
            right,
          },
        );
        for (let p = 0; p < height; p += 1) {
          rows.push({
            kind: 'split',
            file: f,
            hunk: h,
            left: cellAt(left, leftLine, leftStarts, p),
            right: cellAt(right, rightLine, rightStarts, p),
            first: p === 0,
          });
        }
        const lines = [leftLine, rightLine].filter(
          (l): l is DiffLine => l !== null,
        );
        takeComments(pending, lines).forEach((c) => pushCard(f, c, false));
      }
    });
  });

  return { rows, stops, fileRows, geometry };

  function pushStop(
    row: number,
    height: number,
    file: number,
    key: string,
    target: StopTarget,
  ) {
    stops.push({ row, height, file, key, target });
  }

  function pushCard(file: number, comment: ReviewComment, outdated: boolean) {
    const start = rows.length;
    const base = { kind: 'comment', file, comment, outdated } as const;
    rows.push({ ...base, part: 'head', text: '' });
    for (const text of wrapProse(comment.body, cardInner)) {
      rows.push({ ...base, part: 'body', text });
    }
    rows.push({ ...base, part: 'foot', text: '' });
    pushStop(start, rows.length - start, file, stopKey.comment(comment.id), {
      kind: 'comment',
      comment,
    });
  }
}

export function geometryFor(
  files: FileDiff[],
  width: number,
  view: ViewMode,
): Geometry {
  let highest = 0;
  for (const file of files) {
    for (const hunk of file.hunks) {
      highest = Math.max(
        highest,
        hunk.oldStart + hunk.lines.length,
        hunk.newStart + hunk.lines.length,
      );
    }
  }
  const numberWidth = Math.max(MIN_NUMBER_WIDTH, String(highest).length);
  if (view === 'file') {
    // marker · number · comment mark · space
    const gutter = 1 + numberWidth + 1 + 1;
    return {
      numberWidth,
      gutter,
      codeWidth: Math.max(8, width - gutter),
      half: width,
    };
  }
  if (view === 'unified') {
    // marker · number · comment mark · sign + space; one number, as Pierre's diffs show it
    const gutter = 1 + numberWidth + 1 + 2;
    return {
      numberWidth,
      gutter,
      codeWidth: Math.max(8, width - gutter),
      half: width,
    };
  }
  // Two halves around a one-cell rule: marker · number · mark · sign + space
  const half = Math.floor((width - 1) / 2);
  const gutter = 1 + numberWidth + 1 + 2;
  return { numberWidth, gutter, codeWidth: Math.max(4, half - gutter), half };
}

export function cardWidth(geometry: Geometry, room: number): number {
  return Math.max(16, Math.min(MAX_CARD_WIDTH, room - geometry.gutter - 1));
}

/** Where a new comment on `line` is pinned; context lines take `prefer`. */
export function anchorFor(
  file: FileDiff,
  line: DiffLine,
  prefer: Side,
): Anchor {
  const filePath = file.path;
  if (
    line.kind === 'del' ||
    (line.kind === 'context' && prefer === 'deletions')
  ) {
    return { filePath, side: 'deletions', lineNumber: line.oldNo ?? 0 };
  }
  return { filePath, side: 'additions', lineNumber: line.newNo ?? 0 };
}

/**
 * Split-view rows: context on both sides, each run of removals beside the
 * run of additions that follows it.
 */
export function pairLines(
  lines: DiffLine[],
): Array<[number | null, number | null]> {
  const out: Array<[number | null, number | null]> = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i]!.kind === 'context') {
      out.push([i, i]);
      i += 1;
      continue;
    }
    const dels: number[] = [];
    while (i < lines.length && lines[i]!.kind === 'del') dels.push(i++);
    const adds: number[] = [];
    while (i < lines.length && lines[i]!.kind === 'add') adds.push(i++);
    for (let p = 0; p < Math.max(dels.length, adds.length); p += 1) {
      out.push([dels[p] ?? null, adds[p] ?? null]);
    }
  }
  return out;
}

/** Index of the stop covering `row`. */
export function stopAtRow(stops: Stop[], row: number): number {
  let lo = 0;
  let hi = stops.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (stops[mid]!.row <= row) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** The `side:lineNumber` keys a line answers to — context is on both sides. */
export function keysOf(line: DiffLine): string[] {
  const keys: string[] = [];
  if (line.kind !== 'add' && line.oldNo !== null)
    keys.push(commentKey('deletions', line.oldNo));
  if (line.kind !== 'del' && line.newNo !== null)
    keys.push(commentKey('additions', line.newNo));
  return keys;
}

export function commentKey(side: Side, lineNumber: number): string {
  return `${side}:${lineNumber}`;
}

function takeComments(
  pending: Map<string, ReviewComment[]>,
  lines: DiffLine[],
): ReviewComment[] {
  const found: ReviewComment[] = [];
  for (const key of lines.flatMap(keysOf)) {
    const waiting = pending.get(key);
    if (!waiting) continue;
    found.push(...waiting);
    pending.delete(key);
  }
  return found;
}

function noteFor(file: FileDiff): string | null {
  if (file.skipped !== undefined) return file.skipped;
  if (file.binary) return 'Binary file — not shown';
  if (file.hunks.length > 0) return null;
  if (file.status === 'renamed') return 'Renamed without changes';
  if (file.status === 'added') return 'Empty file';
  return 'No content changes';
}

function pieces(text: string, width: number, wrap: boolean): number[] {
  return wrap ? [0, ...wrapPoints(text, width)] : [0];
}

function cellAt(
  index: number | null,
  line: DiffLine | null,
  starts: number[],
  piece: number,
): Cell | null {
  if (index === null || line === null || piece >= starts.length) return null;
  return {
    line: index,
    start: starts[piece]!,
    end: starts[piece + 1] ?? line.text.length,
  };
}

function groupBy<TItem>(
  items: TItem[],
  keyOf: (item: TItem) => string,
): Map<string, TItem[]> {
  const groups = new Map<string, TItem[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}
