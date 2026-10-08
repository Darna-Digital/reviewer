import { cellWidth, TAB_WIDTH } from '../text/measure';

/**
 * The UTF-16 index in the file's own line for an index into its shown text,
 * which `printable` drew with tabs expanded and carriage returns dropped.
 */
export function sourceIndex(raw: string, shownIndex: number): number {
  let shown = '';
  let index = 0;
  for (const char of raw) {
    if (shown.length >= shownIndex) break;
    if (char === '\t')
      shown += ' '.repeat(TAB_WIDTH - (cellWidth(shown) % TAB_WIDTH));
    else if (char !== '\r') shown += char;
    index += char.length;
  }
  return index;
}
