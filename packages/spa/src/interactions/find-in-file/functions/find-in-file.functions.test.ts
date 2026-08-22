import { describe, expect, it } from "vitest";
import {
  DEFAULT_FIND_OPTIONS,
  MAX_FIND_MATCHES,
  findMatches,
  findPattern,
  findStatus,
  indexFrom,
  seedFromSelection,
  sliceRange,
  stepIndex,
} from "./find-in-file.functions";
import type { FindOptions } from "../interfaces/find-in-file.interfaces";

const options = (over: Partial<FindOptions> = {}): FindOptions => ({
  ...DEFAULT_FIND_OPTIONS,
  ...over,
});

const FILE = [
  "const value = 1;",
  "const other = value + value;",
  "// value is not other",
].join("\n");

describe("findMatches", () => {
  it("finds every hit, in reading order, as a slice of its line", () => {
    expect(findMatches(FILE, "value", options())).toEqual([
      { line: 1, start: 6, end: 11 },
      { line: 2, start: 14, end: 19 },
      { line: 2, start: 22, end: 27 },
      { line: 3, start: 3, end: 8 },
    ]);
  });

  it("ignores case unless asked not to", () => {
    expect(findMatches("Value value", "VALUE", options())).toHaveLength(2);
    expect(
      findMatches("Value value", "VALUE", options({ caseSensitive: true }))
    ).toEqual([]);
  });

  it("treats the query literally unless it is a regular expression", () => {
    expect(findMatches("a.b axb", "a.b", options())).toEqual([
      { line: 1, start: 0, end: 3 },
    ]);
    expect(findMatches("a.b axb", "a.b", options({ regex: true }))).toEqual([
      { line: 1, start: 0, end: 3 },
      { line: 1, start: 4, end: 7 },
    ]);
  });

  it("matches whole words only when asked", () => {
    expect(findMatches("value values", "value", options())).toHaveLength(2);
    expect(
      findMatches("value values", "value", options({ wholeWord: true }))
    ).toEqual([{ line: 1, start: 0, end: 5 }]);
  });

  it("finds nothing for an empty query or a half-written expression", () => {
    expect(findMatches(FILE, "", options())).toEqual([]);
    expect(findMatches(FILE, "value(", options({ regex: true }))).toEqual([]);
    expect(findPattern("value(", options({ regex: true }))).toBeNull();
  });

  it("terminates on a pattern that can match nothing", () => {
    expect(findMatches("aaa", "a*", options({ regex: true }))).toEqual([
      { line: 1, start: 0, end: 3 },
    ]);
    expect(findMatches("abc", "x*", options({ regex: true }))).toEqual([]);
  });

  it("stops counting once there are more matches than anyone can read", () => {
    const many = "a\n".repeat(MAX_FIND_MATCHES + 100);
    expect(findMatches(many, "a", options())).toHaveLength(MAX_FIND_MATCHES);
  });
});

describe("stepIndex", () => {
  it("wraps at both ends", () => {
    expect(stepIndex(3, 2, "next")).toBe(0);
    expect(stepIndex(3, 0, "previous")).toBe(2);
    expect(stepIndex(3, 0, "next")).toBe(1);
  });

  it("stays put when there is nothing to step through", () => {
    expect(stepIndex(0, 0, "next")).toBe(0);
    expect(stepIndex(0, 4, "previous")).toBe(0);
  });
});

describe("indexFrom", () => {
  const matches = findMatches(FILE, "value", options());

  it("starts at the first match at or after the anchor", () => {
    expect(indexFrom(matches, { line: 2, character: 0 })).toBe(1);
    expect(indexFrom(matches, { line: 2, character: 20 })).toBe(2);
  });

  it("wraps back to the top when everything is behind the anchor", () => {
    expect(indexFrom(matches, { line: 99, character: 0 })).toBe(0);
  });

  it("starts at the top without an anchor", () => {
    expect(indexFrom(matches, null)).toBe(0);
    expect(indexFrom([], { line: 1, character: 0 })).toBe(0);
  });
});

describe("findStatus", () => {
  it("says nothing before anything has been typed", () => {
    expect(findStatus("", 0, 0)).toBe("");
  });

  it("counts from one", () => {
    expect(findStatus("value", 4, 0)).toBe("1 of 4");
    expect(findStatus("value", 4, 3)).toBe("4 of 4");
  });

  it("owns up to a count that stopped early", () => {
    expect(findStatus("a", MAX_FIND_MATCHES, 0)).toBe(
      `1 of ${MAX_FIND_MATCHES}+`
    );
  });

  it("reports an empty search rather than a count", () => {
    expect(findStatus("nothing", 0, 0)).toBe("No results");
  });
});

describe("seedFromSelection", () => {
  it("carries a phrase across, trimmed", () => {
    expect(seedFromSelection("  useFiles  ")).toBe("useFiles");
  });

  it("refuses what is not a phrase", () => {
    expect(seedFromSelection("")).toBe("");
    expect(seedFromSelection("   ")).toBe("");
    expect(seedFromSelection("one\ntwo")).toBe("");
    expect(seedFromSelection("x".repeat(500))).toBe("");
  });
});

describe("sliceRange", () => {
  it("takes the text between two positions on one line", () => {
    expect(
      sliceRange(FILE, { line: 0, character: 6 }, { line: 0, character: 11 })
    ).toBe("value");
  });

  it("takes the text across lines", () => {
    expect(
      sliceRange(FILE, { line: 0, character: 6 }, { line: 1, character: 5 })
    ).toBe("value = 1;\nconst");
  });

  it("reads a backwards selection the same way", () => {
    expect(
      sliceRange(FILE, { line: 0, character: 11 }, { line: 0, character: 6 })
    ).toBe("value");
  });

  it("is empty for a caret, and for a line that is not there", () => {
    expect(
      sliceRange(FILE, { line: 0, character: 6 }, { line: 0, character: 6 })
    ).toBe("");
    expect(
      sliceRange(FILE, { line: 40, character: 0 }, { line: 41, character: 1 })
    ).toBe("");
  });
});
