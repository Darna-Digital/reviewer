import { describe, expect, it } from "vitest";
import {
  DEFAULT_GREP_OPTIONS,
  createSearchFunctions,
  groupByFile,
  matchKey,
  matchRange,
} from "./search.functions";
import { contentMatch, mockSearchDependencies } from "./search.functions.mock";

describe("search functions", () => {
  it("trims a query before searching for it", async () => {
    const { deps, calls } = mockSearchDependencies();
    const fns = createSearchFunctions(deps);

    await fns.grep("  useFiles  ", DEFAULT_GREP_OPTIONS, "repo");

    expect(calls.grep).toEqual([
      { query: "useFiles", options: DEFAULT_GREP_OPTIONS, scope: "repo" },
    ]);
  });

  it("passes the scope through, so a project searches every root", async () => {
    const { deps, calls } = mockSearchDependencies();
    const fns = createSearchFunctions(deps);

    await fns.grep("useFiles", DEFAULT_GREP_OPTIONS, "project");

    expect(calls.grep[0]?.scope).toBe("project");
  });

  it("does not search for a query that is too short to be useful", async () => {
    const { deps, calls } = mockSearchDependencies();
    const fns = createSearchFunctions(deps);

    const results = await fns.grep("u", DEFAULT_GREP_OPTIONS, "repo");

    expect(results).toEqual({ matches: [], truncated: false });
    expect(calls.grep).toEqual([]);
  });

  it("treats a query of only whitespace as empty", async () => {
    const { deps, calls } = mockSearchDependencies();
    const fns = createSearchFunctions(deps);

    await fns.grep("    ", DEFAULT_GREP_OPTIONS, "repo");

    expect(calls.grep).toEqual([]);
  });
});

describe("groupByFile", () => {
  it("collects a file's matches together, keeping the reported order", () => {
    const grouped = groupByFile([
      contentMatch({ path: "a.ts", line: 1 }),
      contentMatch({ path: "b.ts", line: 4 }),
      contentMatch({ path: "a.ts", line: 9 }),
    ]);

    expect(grouped).toEqual([
      {
        path: "a.ts",
        matches: [
          contentMatch({ path: "a.ts", line: 1 }),
          contentMatch({ path: "a.ts", line: 9 }),
        ],
      },
      { path: "b.ts", matches: [contentMatch({ path: "b.ts", line: 4 })] },
    ]);
  });

  it("has nothing to group when nothing matched", () => {
    expect(groupByFile([])).toEqual([]);
  });
});

describe("matchKey", () => {
  it("separates two matches on the same line", () => {
    const first = contentMatch({ line: 3, column: 1 });
    const second = contentMatch({ line: 3, column: 40 });

    expect(matchKey(first)).not.toBe(matchKey(second));
  });
});

describe("matchRange", () => {
  it("finds the literal hit regardless of case", () => {
    expect(
      matchRange("const useFiles = 1", "usefiles", DEFAULT_GREP_OPTIONS)
    ).toEqual({ start: 6, end: 14 });
  });

  it("takes regex metacharacters literally unless regex is on", () => {
    const text = "value = a.b";

    expect(matchRange(text, "a.b", DEFAULT_GREP_OPTIONS)).toEqual({
      start: 8,
      end: 11,
    });
    expect(matchRange("value = axb", "a.b", DEFAULT_GREP_OPTIONS)).toBeNull();
  });

  it("applies the pattern when regex is on", () => {
    expect(
      matchRange("const useFiles = 1", "use\\w+", {
        ...DEFAULT_GREP_OPTIONS,
        regex: true,
      })
    ).toEqual({ start: 6, end: 14 });
  });

  it("respects case sensitivity and whole words", () => {
    expect(
      matchRange("const useFiles = 1", "usefiles", {
        ...DEFAULT_GREP_OPTIONS,
        caseSensitive: true,
      })
    ).toBeNull();

    expect(
      matchRange("useFilesOnce()", "useFiles", {
        ...DEFAULT_GREP_OPTIONS,
        wholeWord: true,
      })
    ).toBeNull();
  });

  it("highlights nothing for a half-typed regex instead of throwing", () => {
    expect(
      matchRange("const a = 1", "use(", {
        ...DEFAULT_GREP_OPTIONS,
        regex: true,
      })
    ).toBeNull();
  });

  it("highlights nothing when the pattern can match empty text", () => {
    expect(
      matchRange("const a = 1", "x*", { ...DEFAULT_GREP_OPTIONS, regex: true })
    ).toBeNull();
  });
});
