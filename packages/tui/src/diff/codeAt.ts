import type { Geometry, Row } from './buildLayout';
import type { DiffLine, FileDiff } from './parseDiff';

/** Where a click or the pointer landed in code: the line and its shown index. */
export interface CodePoint {
  file: number;
  line: DiffLine;
  /** Index into `line.text`. */
  index: number;
}

/**
 * The line and character under cell `x` of a pane row — unified and file
 * rows past the gutter, either half of a split row. `null` off code.
 */
export function codeAt(opts: {
  row: Row | undefined;
  files: FileDiff[];
  geometry: Geometry;
  scrollX: number;
  x: number;
}): CodePoint | null {
  const { row, files, geometry, scrollX } = opts;
  if (!row || (row.kind !== 'code' && row.kind !== 'split')) return null;
  const hunk = files[row.file]?.hunks[row.hunk];
  if (!hunk) return null;

  if (row.kind === 'code') {
    const column = opts.x - geometry.gutter;
    const line = hunk.lines[row.line];
    if (column < 0 || !line) return null;
    return { file: row.file, line, index: row.start + scrollX + column };
  }

  const right = opts.x > geometry.half;
  const cell = right ? row.right : row.left;
  const column = opts.x - (right ? geometry.half + 1 : 0) - geometry.gutter;
  const line = cell ? hunk.lines[cell.line] : undefined;
  if (!cell || column < 0 || !line) return null;
  return { file: row.file, line, index: cell.start + scrollX + column };
}
