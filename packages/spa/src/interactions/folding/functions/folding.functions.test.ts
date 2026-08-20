import { describe, expect, it } from "vitest";
import {
  closeFold,
  enclosingRegion,
  foldAll,
  foldRegions,
  hiddenLines,
  nearestVisible,
  openFold,
  regionAt,
  survivingFolds,
  toggleFold,
  unfoldAll,
  visibleLine,
} from "./folding.functions";

const CODE = [
  "export function main(a) {", //  0
  "  if (a) {", //                 1
  "    return 1;", //              2
  "", //                           3
  "    return 2;", //              4
  "  }", //                        5
  "  return 0;", //                6
  "}", //                          7
  "", //                           8
  "const flat = 1;", //            9
].join("\n");

const lines = CODE.split("\n");
const regions = foldRegions(lines);
const starts = (set: ReadonlySet<number>) => [...set].sort((a, b) => a - b);

describe("foldRegions", () => {
  it("opens a region on a line followed by deeper ones", () => {
    expect(regions).toContainEqual({ start: 0, end: 6 });
    expect(regions).toContainEqual({ start: 1, end: 4 });
  });

  it("runs a region to its last deeper line, not to the dedent", () => {
    // `}` on line 5 is back at the `if`'s own indent, so the region ends at 4.
    expect(regionAt(regions, 1)).toEqual({ start: 1, end: 4 });
  });

  it("carries blank lines through rather than ending on them", () => {
    // Line 3 is blank and sits inside the `if`.
    expect(regionAt(regions, 1)?.end).toBe(4);
  });

  it("leaves a line with nothing under it unfoldable", () => {
    expect(regionAt(regions, 9)).toBeNull();
    expect(regionAt(regions, 2)).toBeNull();
  });

  it("finds nothing to fold in a flat file", () => {
    expect(foldRegions(["a", "b", "c"])).toEqual([]);
  });

  it("folds by indentation, so it works without brackets at all", () => {
    const yaml = ["root:", "  child: 1", "  other: 2", "next: 3"];
    expect(foldRegions(yaml)).toEqual([{ start: 0, end: 2 }]);
  });
});

describe("enclosingRegion", () => {
  it("prefers the region a line starts", () => {
    expect(enclosingRegion(regions, 1)).toEqual({ start: 1, end: 4 });
  });

  it("falls back to the innermost region the line sits in", () => {
    // Line 2 starts nothing; the block around it is the `if`, not `main`.
    expect(enclosingRegion(regions, 2)).toEqual({ start: 1, end: 4 });
  });

  it("has nothing to offer at the top level", () => {
    expect(enclosingRegion(regions, 9)).toBeNull();
  });
});

describe("hiddenLines", () => {
  it("hides a closed region's body but keeps its header", () => {
    expect(starts(hiddenLines(regions, new Set([1])))).toEqual([2, 3, 4]);
  });

  it("does not double-count a fold closed inside another", () => {
    expect(starts(hiddenLines(regions, new Set([0, 1])))).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it("hides nothing when nothing is closed", () => {
    expect(hiddenLines(regions, new Set()).size).toBe(0);
  });
});

describe("toggling", () => {
  it("closes and reopens the region under the caret", () => {
    const closed = toggleFold(regions, new Set(), 1);
    expect(starts(closed)).toEqual([1]);
    expect(starts(toggleFold(regions, closed, 1))).toEqual([]);
  });

  it("folds the block around a caret that is not on a header", () => {
    expect(starts(toggleFold(regions, new Set(), 2))).toEqual([1]);
  });

  it("leaves a caret with nothing to fold alone", () => {
    expect(starts(toggleFold(regions, new Set([1]), 9))).toEqual([1]);
  });

  it("closes without reopening, and opens without reclosing", () => {
    const closed = closeFold(regions, new Set(), 2);
    expect(starts(closed)).toEqual([1]);
    expect(starts(closeFold(regions, closed, 2))).toEqual([1]);
    expect(starts(openFold(regions, closed, 1))).toEqual([]);
  });

  it("opens the outermost fold actually hiding a line", () => {
    // Both are closed and both cover line 4; opening the inner one would leave
    // it hidden, so the outer one is what gives way.
    expect(starts(openFold(regions, new Set([0, 1]), 4))).toEqual([1]);
  });

  it("closes and opens everything", () => {
    expect(starts(foldAll(regions))).toEqual([0, 1]);
    expect(starts(unfoldAll())).toEqual([]);
  });
});

describe("surviving an edit", () => {
  it("keeps a fold whose header is still a header", () => {
    expect(starts(survivingFolds(regions, new Set([0, 1])))).toEqual([0, 1]);
  });

  it("drops one whose line no longer opens anything", () => {
    // The body was deleted out from under the fold on line 1.
    const flattened = foldRegions(["a {", "b"]);
    expect(starts(survivingFolds(flattened, new Set([1])))).toEqual([]);
  });
});

describe("keeping the caret out of a closed fold", () => {
  const hidden = hiddenLines(regions, new Set([1]));

  it("puts a caret on a hidden line back on its header", () => {
    expect(visibleLine(hidden, regions, new Set([1]), 3)).toBe(1);
  });

  it("leaves a visible caret where it is", () => {
    expect(visibleLine(hidden, regions, new Set([1]), 6)).toBe(6);
  });

  it("steps over a folded block in one move", () => {
    expect(nearestVisible(hidden, 2, "down", lines.length)).toBe(5);
    expect(nearestVisible(hidden, 4, "up", lines.length)).toBe(1);
  });

  it("gives up when everything that way is folded", () => {
    const all = new Set([1, 2, 3]);
    expect(nearestVisible(all, 1, "down", 4)).toBe(undefined);
  });

  it("passes a line straight through when nothing is folded", () => {
    expect(nearestVisible(new Set(), 5, "down", 10)).toBe(5);
  });
});
