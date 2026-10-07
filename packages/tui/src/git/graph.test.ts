import { describe, expect, test } from 'bun:test';
import { layoutGraph } from './graph';
import type { GraphCommit } from './graph';

const draw = (commits: GraphCommit[]) =>
  layoutGraph(commits).map((row) =>
    row.cells.map((cell) => cell.glyph).join(''),
  );

describe('layoutGraph', () => {
  test('a straight line is one lane', () => {
    expect(
      draw([
        { sha: 'c', parents: ['b'] },
        { sha: 'b', parents: ['a'] },
        { sha: 'a', parents: [] },
      ]),
    ).toEqual(['●', '●', '●']);
  });

  test('a merge opens a lane and the branch folds back in', () => {
    expect(
      draw([
        { sha: 'm', parents: ['b', 'f'] },
        { sha: 'f', parents: ['a'] },
        { sha: 'b', parents: ['a'] },
        { sha: 'a', parents: [] },
      ]),
    ).toEqual(['●─╮', '│ ●', '●─╯', '●']);
  });

  test('a line joining a lane to its left crosses the lanes between', () => {
    expect(
      draw([
        { sha: 'x', parents: ['a'] },
        { sha: 'm', parents: ['b', 'f'] },
        { sha: 'f', parents: ['a'] },
        { sha: 'b', parents: ['a'] },
        { sha: 'a', parents: [] },
      ]),
    ).toEqual(['●', '│ ●─╮', '├─┼─●', '├─●', '●']);
  });

  test('a lane keeps its colour for its whole life', () => {
    const rows = layoutGraph([
      { sha: 'm', parents: ['b', 'f'] },
      { sha: 'f', parents: ['a'] },
      { sha: 'b', parents: ['a'] },
      { sha: 'a', parents: [] },
    ]);
    const branch = rows[0]!.cells[2]!.lane;
    expect(rows[1]!.cells[2]!.lane).toBe(branch);
    expect(rows[2]!.cells[2]!.lane).toBe(branch);
    expect(rows[3]!.cells[0]!.lane).toBe(rows[0]!.cells[0]!.lane);
  });
});
