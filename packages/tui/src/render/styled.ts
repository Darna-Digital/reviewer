import { StyledText, TextAttributes } from '@opentui/core';
import type { TextChunk } from '@opentui/core';
import { cellWidth, truncate } from '../text/measure';
import { rgba } from './palette';

/** A run of text with one style. Rows are built as `Seg[]`. */
export interface Seg {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/** Cuts or pads `segs` to exactly `width` cells; padding takes `fill`. */
export function fitSegs(segs: Seg[], width: number, fill?: string): Seg[] {
  const out: Seg[] = [];
  let used = 0;
  for (const seg of segs) {
    if (used >= width) break;
    if (!seg.text) continue;
    const w = cellWidth(seg.text);
    if (used + w <= width) {
      out.push(seg);
      used += w;
      continue;
    }
    const cut = truncate(seg.text, width - used);
    out.push({ ...seg, text: cut });
    used += cellWidth(cut);
  }
  if (used < width) out.push({ text: ' '.repeat(width - used), bg: fill });
  return out;
}

/** `left`, then `right` flush against the far edge. */
export function spread(
  left: Seg[],
  right: Seg[],
  width: number,
  fill?: string,
): Seg[] {
  const room = Math.max(0, width - segsWidth(right) - 1);
  return fitSegs(
    [...fitSegs(left, room, fill), { text: ' ', bg: fill }, ...right],
    width,
    fill,
  );
}

export function segsWidth(segs: Seg[]): number {
  return segs.reduce((sum, seg) => sum + cellWidth(seg.text), 0);
}

export function toStyledText(segs: Seg[]): StyledText {
  return new StyledText(segs.map(toChunk));
}

function toChunk(seg: Seg): TextChunk {
  return {
    __isChunk: true,
    text: seg.text,
    fg: seg.fg ? rgba(seg.fg) : undefined,
    bg: seg.bg ? rgba(seg.bg) : undefined,
    attributes:
      (seg.bold ? TextAttributes.BOLD : 0) |
      (seg.italic ? TextAttributes.ITALIC : 0) |
      (seg.underline ? TextAttributes.UNDERLINE : 0),
  };
}
