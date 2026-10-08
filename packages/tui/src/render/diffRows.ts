import type { ReviewComment } from '@reviewer/core/comments';
import { cardWidth } from '../diff/buildLayout';
import type { Cell, Geometry, Row, ViewMode } from '../diff/buildLayout';
import type { FileTokens } from '../diff/highlight';
import { lineKey } from '../diff/inlineChanges';
import type { Span } from '../diff/inlineChanges';
import type { DiffLine, FileDiff, FileStatus } from '../diff/parseDiff';
import { cellWidth, padStart, truncate, truncateStart } from '../text/measure';
import { ago } from '../text/time';
import type { FileIcons } from './fileIcons';
import { mix } from './palette';
import type { Palette } from './palette';
import { fitSegs, segsWidth } from './styled';
import type { Seg } from './styled';

export type CursorSide = 'left' | 'right';

export interface PaintContext {
  palette: Palette;
  icons: FileIcons;
  files: FileDiff[];
  geometry: Geometry;
  width: number;
  view: ViewMode;
  collapsed: ReadonlySet<string>;
  /** The pane has the keyboard; the cursor is drawn quieter when not. */
  focused: boolean;
  cursorSide: CursorSide;
  /** Columns the unwrapped code is scrolled sideways. */
  scrollX: number;
  /** The word cursor: a symbol on one line, marked where it is drawn. */
  cursorWord: {
    file: number;
    hunk: number;
    line: number;
    start: number;
    end: number;
  } | null;
  now: number;
  tokensOf: (file: number) => FileTokens | undefined;
  inlineOf: (file: number) => Map<string, Span>;
  commentsAt: (file: number, line: DiffLine) => number;
  commentsIn: (file: number) => number;
}

export const STATUS_LETTER: Record<FileStatus, string> = {
  added: 'A',
  deleted: 'D',
  modified: 'M',
  renamed: 'R',
};

export function statusColor(palette: Palette, status: FileStatus): string {
  const colors: Record<FileStatus, string> = {
    added: palette.added,
    deleted: palette.deleted,
    modified: palette.modified,
    renamed: palette.renamed,
  };
  return colors[status];
}

/** Paints one layout row; `cursor` is whether the cursor covers it. */
export function paintRow(ctx: PaintContext, row: Row, cursor: boolean): Seg[] {
  switch (row.kind) {
    case 'spacer':
      return fitSegs([], ctx.width, ctx.palette.island);
    case 'file':
      return paintFileHeader(ctx, row.file, cursor);
    case 'hunk':
      return paintHunk(ctx, row);
    case 'code':
      return paintUnified(ctx, row, cursor);
    case 'split':
      return paintSplit(ctx, row, cursor);
    case 'comment':
      return paintCard(ctx, row, cursor);
    case 'note':
      return fitSegs(
        [
          { text: ' '.repeat(ctx.geometry.gutter), bg: ctx.palette.island },
          {
            text: row.text,
            fg: ctx.palette.faint,
            bg: ctx.palette.island,
            italic: true,
          },
        ],
        ctx.width,
        ctx.palette.island,
      );
  }
}

export function paintFileHeader(
  ctx: PaintContext,
  index: number,
  cursor: boolean,
  width = ctx.width,
): Seg[] {
  const { palette } = ctx;
  const file = ctx.files[index]!;
  const bg = lit(palette, palette.diff.fileBg, cursor);
  const comments = ctx.commentsIn(index);

  const right: Seg[] = [];
  if (comments > 0)
    right.push({ text: `◆ ${comments}  `, fg: palette.accent, bg });
  if (file.additions > 0)
    right.push({
      text: `+${file.additions}`,
      fg: palette.added,
      bg,
      bold: true,
    });
  if (file.additions > 0 && file.deletions > 0) right.push({ text: ' ', bg });
  if (file.deletions > 0)
    right.push({
      text: `−${file.deletions}`,
      fg: palette.deleted,
      bg,
      bold: true,
    });
  if (file.binary) right.push({ text: 'binary', fg: palette.faint, bg });
  right.push({ text: ' ', bg });

  const slash = file.path.lastIndexOf('/');
  const dir =
    (file.oldPath ? `${file.oldPath} → ` : '') + file.path.slice(0, slash + 1);
  const name = file.path.slice(slash + 1);
  const left: Seg[] = [
    marker(ctx, cursor, bg),
    { text: ctx.collapsed.has(file.path) ? '▸ ' : '▾ ', fg: palette.muted, bg },
    {
      text: STATUS_LETTER[file.status],
      fg: statusColor(palette, file.status),
      bg,
      bold: true,
    },
    { text: ' ', bg },
  ];
  const icon = ctx.icons.file(file.path, bg);
  const room = width - segsWidth(left) - segsWidth(icon) - segsWidth(right) - 2;
  const shownName = truncate(name, Math.max(4, room));
  left.push(
    ...icon,
    {
      text: truncateStart(dir, Math.max(0, room - cellWidth(shownName))),
      fg: palette.muted,
      bg,
    },
    { text: shownName, fg: palette.text, bg, bold: true },
  );
  const gap = Math.max(1, width - segsWidth(left) - segsWidth(right));
  return fitSegs([...left, { text: ' '.repeat(gap), bg }, ...right], width, bg);
}

interface LineLook {
  bg: string;
  gutterBg: string;
  emphasis: string;
  sign: string;
  signFg: string;
  numberFg: string;
}

function lookOf(palette: Palette, line: DiffLine | null): LineLook {
  const { diff } = palette;
  if (!line) {
    return {
      bg: diff.emptyBg,
      gutterBg: diff.emptyBg,
      emphasis: diff.emptyBg,
      sign: ' ',
      signFg: palette.faint,
      numberFg: palette.faint,
    };
  }
  if (line.kind === 'context') {
    return {
      bg: palette.island,
      gutterBg: palette.island,
      emphasis: palette.island,
      sign: ' ',
      signFg: palette.faint,
      numberFg: diff.lineNumber,
    };
  }
  const added = line.kind === 'add';
  const gutterBg = added ? diff.addGutter : diff.delGutter;
  const color = added ? palette.added : palette.deleted;
  return {
    bg: added ? diff.addBg : diff.delBg,
    gutterBg,
    emphasis: added ? diff.addEmphasis : diff.delEmphasis,
    sign: added ? '+' : '-',
    signFg: color,
    numberFg: mix(gutterBg, color, 0.75),
  };
}

function lit(palette: Palette, color: string, on: boolean): string {
  return on ? mix(color, palette.accent, 0.16) : color;
}

function marker(ctx: PaintContext, cursor: boolean, bg: string): Seg {
  return {
    text: cursor ? (ctx.focused ? '▌' : '▏') : ' ',
    fg: ctx.palette.accent,
    bg,
  };
}

function lineNumber(
  value: number | null,
  width: number,
  show: boolean,
): string {
  return show && value !== null
    ? padStart(String(value), width)
    : ' '.repeat(width);
}

/** Code from `start` to `end` in syntax colours, the changed band emphasised. */
function codeSegs(
  ctx: PaintContext,
  file: number,
  hunk: number,
  index: number,
  line: DiffLine,
  range: { start: number; end: number },
  look: LineLook,
  cursor: boolean,
): Seg[] {
  const key = lineKey(hunk, index);
  const band = ctx.inlineOf(file).get(key);
  const picked = ctx.cursorWord;
  const word =
    cursor &&
    picked &&
    picked.file === file &&
    picked.hunk === hunk &&
    picked.line === index
      ? picked
      : null;
  const wordBg = mix(look.bg, ctx.palette.accent, 0.32);
  const bg = lit(ctx.palette, look.bg, cursor);
  const emphasis = lit(ctx.palette, look.emphasis, cursor);
  const tokens = ctx.tokensOf(file)?.get(key) ?? [{ text: line.text }];
  const out: Seg[] = [];
  let offset = 0;
  const start = range.start + ctx.scrollX;

  for (const token of tokens) {
    const from = offset;
    offset += token.text.length;
    const a = Math.max(from, start);
    const b = Math.min(offset, range.end);
    if (a >= b) continue;
    const cuts = [a, b];
    if (band && band.start > a && band.start < b) cuts.push(band.start);
    if (band && band.end > a && band.end < b) cuts.push(band.end);
    if (word && word.start > a && word.start < b) cuts.push(word.start);
    if (word && word.end > a && word.end < b) cuts.push(word.end);
    cuts.sort((x, y) => x - y);
    for (let i = 0; i < cuts.length - 1; i += 1) {
      const s = cuts[i]!;
      const e = cuts[i + 1]!;
      if (s === e) continue;
      const inBand = !!band && s >= band.start && e <= band.end;
      const onWord = !!word && s >= word.start && e <= word.end;
      out.push({
        text: token.text.slice(s - from, e - from),
        fg: token.color ?? ctx.palette.text,
        bg: onWord ? wordBg : inBand ? emphasis : bg,
        bold: token.bold || onWord,
        italic: token.italic,
        underline: onWord,
      });
    }
  }
  return out;
}

function paintUnified(
  ctx: PaintContext,
  row: Extract<Row, { kind: 'code' }>,
  cursor: boolean,
): Seg[] {
  const { palette, geometry } = ctx;
  const line = ctx.files[row.file]!.hunks[row.hunk]!.lines[row.line]!;
  const look = lookOf(palette, line);
  const gutterBg = lit(palette, look.gutterBg, cursor);
  const bg = lit(palette, look.bg, cursor);
  const numberFg = cursor ? palette.text : look.numberFg;
  const commented = row.first && ctx.commentsAt(row.file, line) > 0;
  const code = codeSegs(
    ctx,
    row.file,
    row.hunk,
    row.line,
    line,
    row,
    look,
    cursor,
  );

  if (ctx.view === 'file') {
    return fitSegs(
      [
        marker(ctx, cursor, gutterBg),
        {
          text: lineNumber(line.newNo, geometry.numberWidth, row.first),
          fg: numberFg,
          bg: gutterBg,
        },
        { text: commented ? '◆' : ' ', fg: palette.accent, bg: gutterBg },
        { text: ' ', bg },
        ...code,
      ],
      ctx.width,
      bg,
    );
  }

  return fitSegs(
    [
      marker(ctx, cursor, gutterBg),
      {
        text: lineNumber(
          line.kind === 'del' ? line.oldNo : line.newNo,
          geometry.numberWidth,
          row.first,
        ),
        fg: numberFg,
        bg: gutterBg,
      },
      { text: commented ? '◆' : ' ', fg: palette.accent, bg: gutterBg },
      { text: row.first ? look.sign : ' ', fg: look.signFg, bg, bold: true },
      { text: ' ', bg },
      ...code,
    ],
    ctx.width,
    bg,
  );
}

function paintSplit(
  ctx: PaintContext,
  row: Extract<Row, { kind: 'split' }>,
  cursor: boolean,
): Seg[] {
  const leftLit =
    cursor &&
    row.left !== null &&
    (ctx.cursorSide === 'left' || row.right === null);
  const rightLit =
    cursor &&
    row.right !== null &&
    (ctx.cursorSide === 'right' || row.left === null);
  return [
    ...paintHalf(ctx, row, row.left, 'old', leftLit),
    { text: '│', fg: ctx.palette.hairline, bg: ctx.palette.island },
    ...fitSegs(
      paintHalf(ctx, row, row.right, 'new', rightLit),
      ctx.width - ctx.geometry.half - 1,
      ctx.palette.island,
    ),
  ];
}

function paintHalf(
  ctx: PaintContext,
  row: Extract<Row, { kind: 'split' }>,
  cell: Cell | null,
  side: 'old' | 'new',
  cursor: boolean,
): Seg[] {
  const { palette, geometry } = ctx;
  const line = cell
    ? ctx.files[row.file]!.hunks[row.hunk]!.lines[cell.line]!
    : null;
  const look = lookOf(palette, line);
  const gutterBg = lit(palette, look.gutterBg, cursor);
  const bg = lit(palette, look.bg, cursor);
  const number = line ? (side === 'old' ? line.oldNo : line.newNo) : null;
  const commented = row.first && !!line && ctx.commentsAt(row.file, line) > 0;

  const segs: Seg[] = [
    marker(ctx, cursor, gutterBg),
    {
      text: lineNumber(number, geometry.numberWidth, row.first),
      fg: cursor ? palette.text : look.numberFg,
      bg: gutterBg,
    },
    { text: commented ? '◆' : ' ', fg: palette.accent, bg: gutterBg },
    {
      text: row.first && line ? look.sign : ' ',
      fg: look.signFg,
      bg,
      bold: true,
    },
    { text: ' ', bg },
  ];
  if (line && cell) {
    segs.push(
      ...codeSegs(ctx, row.file, row.hunk, cell.line, line, cell, look, cursor),
    );
  }
  return fitSegs(segs, geometry.half, bg);
}

function paintHunk(
  ctx: PaintContext,
  row: Extract<Row, { kind: 'hunk' }>,
): Seg[] {
  const { palette, geometry } = ctx;
  const hunk = ctx.files[row.file]!.hunks[row.hunk]!;
  const bg = palette.diff.hunkBg;
  const segs: Seg[] = [
    {
      text: `${padStart('⋯', Math.max(1, geometry.gutter - 2))}  `,
      fg: palette.diff.hunkText,
      bg,
    },
    {
      text: `@@ −${hunk.oldStart} +${hunk.newStart} @@`,
      fg: palette.faint,
      bg,
    },
  ];
  if (hunk.section) {
    segs.push({
      text: `  ${hunk.section}`,
      fg: palette.diff.hunkText,
      bg,
      italic: true,
    });
  }
  return fitSegs(segs, ctx.width, bg);
}

/** Left edge and width of a comment card. */
function cardBox(
  ctx: PaintContext,
  comment: ReviewComment,
): [left: number, width: number] {
  const { geometry } = ctx;
  if (ctx.view !== 'split') {
    return [geometry.gutter, cardWidth(geometry, ctx.width)];
  }
  const offset = comment.side === 'additions' ? geometry.half + 1 : 0;
  return [offset + geometry.gutter, cardWidth(geometry, geometry.half)];
}

function paintCard(
  ctx: PaintContext,
  row: Extract<Row, { kind: 'comment' }>,
  cursor: boolean,
): Seg[] {
  const { palette } = ctx;
  const [left, width] = cardBox(ctx, row.comment);
  const card = cursor
    ? mix(palette.control, palette.accent, 0.08)
    : palette.control;
  const border = cursor
    ? palette.accent
    : row.outdated
      ? mix(palette.control, palette.warning, 0.55)
      : mix(palette.control, palette.muted, 0.4);
  const inner = width - 2;

  const lead: Seg[] = [
    {
      text: cursor && ctx.focused ? '▌' : ' ',
      fg: palette.accent,
      bg: palette.island,
    },
    { text: ' '.repeat(Math.max(0, left - 1)), bg: palette.island },
  ];
  return fitSegs([...lead, ...cardPart()], ctx.width, palette.island);

  function cardPart(): Seg[] {
    if (row.part === 'foot') {
      return [{ text: `╰${'─'.repeat(inner)}╯`, fg: border, bg: card }];
    }
    if (row.part === 'body') {
      return [
        { text: '│ ', fg: border, bg: card },
        ...fitSegs(
          [{ text: row.text, fg: palette.text, bg: card }],
          inner - 2,
          card,
        ),
        { text: ' │', fg: border, bg: card },
      ];
    }
    const meta: Seg[] = [
      { text: '─ ', fg: border, bg: card },
      { text: row.comment.author, fg: palette.text, bg: card, bold: true },
      {
        text: ` · ${ago(row.comment.createdAt, ctx.now)}`,
        fg: palette.faint,
        bg: card,
      },
    ];
    if (row.outdated) {
      meta.push({
        text: ` · line ${row.comment.lineNumber} not in diff`,
        fg: palette.warning,
        bg: card,
      });
    }
    meta.push({ text: ' ', bg: card });
    const fill = Math.max(0, inner - segsWidth(meta));
    return [
      { text: '╭', fg: border, bg: card },
      ...fitSegs(meta, inner - fill, card),
      { text: '─'.repeat(fill), fg: border, bg: card },
      { text: '╮', fg: border, bg: card },
    ];
  }
}
