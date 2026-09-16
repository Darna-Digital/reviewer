// The reviewer mark is a blocky "R" drawn on a 3×4 grid of equal cells. The
// original artwork used 55px cells inside a 355px tile, which is the ratio the
// defaults in `config.ts` reproduce.
export const MARK_COLUMNS = 3;
export const MARK_ROWS = 4;

const MARK_PATTERN = ["###", "# #", "## ", "# #"] as const;

export type MarkCell = { column: number; row: number };

export const MARK_CELLS: Array<MarkCell> = MARK_PATTERN.flatMap((line, row) =>
  [...line].flatMap((char, column) => (char === "#" ? [{ column, row }] : []))
);
