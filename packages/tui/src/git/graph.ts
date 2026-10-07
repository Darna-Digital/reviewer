/** One commit as the graph needs it. */
export interface GraphCommit {
  sha: string;
  parents: string[];
}

/** One cell of a graph row; `lane` picks the colour, `null` is blank. */
export interface GraphCell {
  glyph: string;
  lane: number | null;
}

export interface GraphRow {
  /** Two cells per lane: the lane itself, then the gap to its right. */
  cells: GraphCell[];
  /** Lane the commit sits in. */
  column: number;
}

interface Lane {
  /** The commit this lane is waiting for. */
  sha: string;
  /** Colour index, kept for the lane's whole life. */
  color: number;
}

type Edge = 'merge-in' | 'branch-out' | 'join';

/**
 * Lays a log out one commit per row, the way GUI history graphs do: each
 * lane waits for a sha, a commit takes the lane waiting for it, lanes that
 * also waited for it close into it, and its parents take over its lane or
 * open new ones; a line keeps to the leftmost lane it can. Every row is
 * drawn from box glyphs that meet at cell edges.
 * Commits must come children-first (`--date-order` or `--topo-order`).
 */
export function layoutGraph(commits: GraphCommit[]): GraphRow[] {
  const lanes: Array<Lane | null> = [];
  let nextColor = 0;
  const open = (sha: string, from = 0): number => {
    let at = lanes.indexOf(null, from);
    if (at === -1) at = lanes.length;
    lanes[at] = { sha, color: nextColor++ };
    return at;
  };

  return commits.map((commit) => {
    let column = lanes.findIndex((lane) => lane?.sha === commit.sha);
    if (column === -1) column = open(commit.sha);
    const color = lanes[column]!.color;
    const before = lanes.map((lane) => lane?.color ?? null);
    const edges = new Map<number, { kind: Edge; color: number }>();

    lanes.forEach((lane, i) => {
      if (i !== column && lane?.sha === commit.sha) {
        edges.set(i, { kind: 'merge-in', color: lane.color });
        lanes[i] = null;
      }
    });

    const [first, ...rest] = commit.parents;
    if (first === undefined) {
      lanes[column] = null;
    } else {
      const taken = lanes.findIndex((lane) => lane?.sha === first);
      if (taken === -1) {
        lanes[column] = { sha: first, color };
      } else if (taken > column) {
        edges.set(taken, { kind: 'merge-in', color: lanes[taken]!.color });
        lanes[taken] = null;
        lanes[column] = { sha: first, color };
      } else {
        edges.set(taken, { kind: 'join', color: lanes[taken]!.color });
        lanes[column] = null;
      }
    }
    for (const parent of rest) {
      const taken = lanes.findIndex((lane) => lane?.sha === parent);
      if (taken !== -1) {
        edges.set(taken, { kind: 'join', color: lanes[taken]!.color });
      } else {
        const at = open(parent, column + 1);
        edges.set(at, { kind: 'branch-out', color: lanes[at]!.color });
      }
    }

    const after = lanes.map((lane) => lane?.color ?? null);
    while (lanes.length > 0 && lanes.at(-1) === null) lanes.pop();
    return { column, cells: drawRow(column, color, before, after, edges) };
  });
}

/** Widest row, in cells. */
export function graphWidth(rows: GraphRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.cells.length), 0);
}

/** `before` / `after`: each lane's colour above and below the row, or `null`. */
function drawRow(
  column: number,
  color: number,
  before: Array<number | null>,
  after: Array<number | null>,
  edges: Map<number, { kind: Edge; color: number }>,
): GraphCell[] {
  const width = Math.max(before.length, after.length, column + 1);
  const reach = [...edges.keys()];
  const low = Math.min(column, ...reach);
  const high = Math.max(column, ...reach);
  const cells: GraphCell[] = [];

  for (let i = 0; i < width; i += 1) {
    const edge = edges.get(i);
    const passing = before[i] ?? after[i] ?? null;
    const spanned = i > low && i < high;
    if (i === column) cells.push({ glyph: '●', lane: color });
    else if (edge)
      cells.push({ glyph: edgeGlyph(edge.kind, i > column), lane: edge.color });
    else if (passing !== null)
      cells.push({ glyph: spanned ? '┼' : '│', lane: passing });
    else if (spanned) cells.push({ glyph: '─', lane: dashColor(i) });
    else cells.push({ glyph: ' ', lane: null });

    cells.push(
      i >= low && i < high
        ? { glyph: '─', lane: dashColor(i + 0.5) }
        : { glyph: ' ', lane: null },
    );
  }
  while (cells.length > 0 && cells.at(-1)!.glyph === ' ') cells.pop();
  return cells;

  /** Dashes take the colour of the nearest edge they lead to. */
  function dashColor(at: number): number {
    const ahead = reach
      .filter((r) => (at > column ? r > at : r < at))
      .sort((a, b) => Math.abs(a - at) - Math.abs(b - at));
    return ahead[0] === undefined ? color : edges.get(ahead[0])!.color;
  }
}

function edgeGlyph(kind: Edge, right: boolean): string {
  switch (kind) {
    case 'merge-in':
      return right ? '╯' : '╰';
    case 'branch-out':
      return right ? '╮' : '╭';
    case 'join':
      return right ? '┤' : '├';
  }
}
