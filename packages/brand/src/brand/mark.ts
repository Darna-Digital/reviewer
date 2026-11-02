// The reviewer mark is a blocky "R" drawn on a 3×4 grid of equal cells. The
// original artwork used 55px cells inside a 355px tile, which is the ratio the
// defaults in `config.ts` reproduce.
//
// The block wordmark spells the name in the mark's construction — square
// stems one cell thick, no curves, a corner-to-corner step where a stroke has
// to turn, as the R's leg does — on a finer 4×5 grid, so the letters are open
// enough to sit quietly in a row. Each letter fills its box: `#` is ink and
// `+` is a counter painted in a fainter tone, leaving only the top of each
// opening empty. That keeps every letter reading as one even block, the row
// as a steady rhythm, and gives the counters a little depth.
const MARK_PATTERN = ["###", "# #", "## ", "# #"];
export const MARK_COLUMNS = MARK_PATTERN[0].length;
export const MARK_ROWS = MARK_PATTERN.length;

const WORDMARK_GLYPHS: Record<string, ReadonlyArray<string>> = {
  R: ["####", "#  #", "### ", "#++#", "#++#"],
  E: ["####", "#   ", "### ", "#+++", "####"],
  V: ["#  #", "#++#", "#++#", "#++#", " ## "],
  I: ["###", "+#+", "+#+", "+#+", "###"],
  W: ["#   #", "#+#+#", "#+#+#", "#+#+#", " # # "],
};
export const WORDMARK_ROWS = 5;

/** Empty columns between two letters, and the width a space takes. */
const LETTER_GAP = 1;
const SPACE_WIDTH = 2;

export type MarkCell = { column: number; row: number };

function cellsOf(pattern: ReadonlyArray<string>, paint: string, offset = 0) {
  return pattern.flatMap((line, row) =>
    [...line].flatMap((char, column) =>
      char === paint ? [{ column: offset + column, row }] : []
    )
  );
}

export const MARK_CELLS: Array<MarkCell> = cellsOf(MARK_PATTERN, "#");

/**
 * The wordmark laid out in cells, ink and counters apart. Letters the
 * alphabet has no glyph for are dropped rather than guessed at; a space opens
 * a two-column gap.
 */
export function blockWordmark(text: string): {
  cells: Array<MarkCell>;
  counters: Array<MarkCell>;
  columns: number;
} {
  const cells: Array<MarkCell> = [];
  const counters: Array<MarkCell> = [];
  let cursor = 0;
  for (const char of text.toUpperCase()) {
    const glyph = WORDMARK_GLYPHS[char];
    if (char === " ") cursor += SPACE_WIDTH;
    if (!glyph) continue;
    if (cells.length) cursor += LETTER_GAP;
    cells.push(...cellsOf(glyph, "#", cursor));
    counters.push(...cellsOf(glyph, "+", cursor));
    cursor += glyph[0].length;
  }
  return { cells, counters, columns: cursor };
}
