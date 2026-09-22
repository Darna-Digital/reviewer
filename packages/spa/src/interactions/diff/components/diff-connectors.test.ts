import { describe, expect, it } from "vitest";
import { ribbonsFrom, type Row } from "./diff-connectors";

/** A row of one line, at a line's height, the way a column stacks them. */
const LINE = 20;
const line = (index: number, change = true): Row => ({
  top: index * LINE,
  bottom: (index + 1) * LINE,
  change,
});
const block = (from: number, to: number, change = true): Row => ({
  top: from * LINE,
  bottom: to * LINE,
  change,
});

describe("ribbonsFrom", () => {
  it("draws one ribbon per run of changed lines", () => {
    const left = [line(2), line(3), line(9)];
    const right = [line(2), line(3), line(9)];
    const ribbons = ribbonsFrom(left, right);
    expect(ribbons.map((ribbon) => ribbon.kind)).toEqual(["mod", "mod"]);
    expect(ribbons[0]).toMatchObject({ leftTop: 40, leftBottom: 80 });
    expect(ribbons[1]).toMatchObject({ leftTop: 180, leftBottom: 200 });
  });

  it("names a side that has nothing in the band", () => {
    // The deletions column pads where the additions column gains lines.
    const left = [block(2, 4, false)];
    const right = [line(2), line(3)];
    expect(ribbonsFrom(left, right).map((ribbon) => ribbon.kind)).toEqual([
      "add",
    ]);
    expect(ribbonsFrom(right, left).map((ribbon) => ribbon.kind)).toEqual([
      "del",
    ]);
  });

  /**
   * The regression this file exists for. A column answers with its gutter and
   * its code as two runs spliced together, so the rows arrive out of order;
   * read that way, the last band reached back over the whole file and its
   * ribbon was drawn across every other one.
   */
  it("reads rows that arrive out of order the same as rows in order", () => {
    const inOrder = [line(2), line(3), line(9), line(15), line(16)];
    const spliced = [line(9), line(15), line(16), line(2), line(3)];
    expect(ribbonsFrom(spliced, spliced)).toEqual(
      ribbonsFrom(inOrder, inOrder)
    );
  });

  it("keeps a late band off the ones above it", () => {
    const spliced = [line(15), line(16), line(2), line(3)];
    const ribbons = ribbonsFrom(spliced, spliced);
    expect(ribbons).toHaveLength(2);
    // The second ribbon starts below the first ends, rather than swallowing it.
    expect(ribbons[1].leftTop).toBeGreaterThanOrEqual(ribbons[0].leftBottom);
  });

  it("makes one band of a buffer and the lines it spans", () => {
    // A tall buffer on the short side covers the run opposite it.
    const left = [block(2, 8, false)];
    const right = [line(2), line(3), line(4), line(5), line(6), line(7)];
    const ribbons = ribbonsFrom(left, right);
    expect(ribbons).toHaveLength(1);
    expect(ribbons[0]).toMatchObject({ kind: "add", rightTop: 40 });
  });

  it("has nothing to draw for a file with no changed rows", () => {
    expect(ribbonsFrom([block(0, 4, false)], [block(0, 4, false)])).toEqual([]);
    expect(ribbonsFrom([], [])).toEqual([]);
  });
});
