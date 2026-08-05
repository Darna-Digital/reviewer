import type {
  CommitGraphDependencies,
  CommitGraphFunctions,
  CommitGraphLayout,
  Lane,
} from "../interfaces/commit-graph.interfaces";

export function createCommitGraphFunctions(
  d: CommitGraphDependencies
): CommitGraphFunctions {
  const { colors, colWidth } = d.data;

  /**
   * Lay the commits out into swim-lanes. Commits arrive newest-first; each lane
   * tracks the next commit it expects (a child placed it there). A commit takes
   * the leftmost lane pointing at it, its first parent continues that lane, and
   * extra parents (merges) open new lanes.
   *
   * Only parents present in this window get a lane. A filtered log — one file's
   * history, an author search — is a sparse slice of the graph where almost no
   * commit's parent is on screen, and lanes waiting on commits that never
   * arrive would pile up into a staircase of lines connecting nothing.
   */
  const buildLayout: CommitGraphFunctions["buildLayout"] = (commits) => {
    const inWindow = new Set(commits.map((commit) => commit.sha));
    const lanes: Array<Lane | null> = [];
    let colorCounter = 0;
    const nextColor = () => colors[colorCounter++ % colors.length];
    const firstFree = () => {
      const i = lanes.indexOf(null);
      return i === -1 ? lanes.length : i;
    };

    const rows: CommitGraphLayout["rows"] = [];
    const mutableRows = rows as Array<CommitGraphLayout["rows"][number]>;
    let width = 1;

    for (const commit of commits) {
      const before = lanes.map((lane) => (lane ? { ...lane } : null));

      let dotCol = lanes.findIndex(
        (lane) => lane !== null && lane.target === commit.sha
      );
      let color: string;
      if (dotCol === -1) {
        dotCol = firstFree();
        color = nextColor();
        lanes[dotCol] = { target: commit.sha, color };
      } else {
        color = lanes[dotCol]!.color;
      }

      // Other lanes pointing at this same commit converge into it and end here.
      for (let k = 0; k < lanes.length; k++) {
        if (k !== dotCol && lanes[k]?.target === commit.sha) lanes[k] = null;
      }

      const written: Array<number> = [dotCol];
      const [first, ...extra] = commit.parents.filter((parent) =>
        inWindow.has(parent)
      );
      if (first === undefined) {
        lanes[dotCol] = null;
      } else {
        lanes[dotCol] = { target: first, color };
        for (const parent of extra) {
          const col = firstFree();
          lanes[col] = { target: parent, color: nextColor() };
          written.push(col);
        }
      }

      const after = lanes.map((lane) => (lane ? { ...lane } : null));
      width = Math.max(width, before.length, after.length);
      mutableRows.push({
        sha: commit.sha,
        dotCol,
        color,
        isMerge: commit.parents.length > 1,
        before,
        after,
        written,
      });

      while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();
    }

    return { rows, width };
  };

  const centerX: CommitGraphFunctions["centerX"] = (col) =>
    col * colWidth + colWidth / 2;

  const edgePath: CommitGraphFunctions["edgePath"] = (x1, y1, x2, y2) =>
    x1 === x2
      ? `M ${x1} ${y1} L ${x2} ${y2}`
      : `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`;

  return { buildLayout, centerX, edgePath };
}
