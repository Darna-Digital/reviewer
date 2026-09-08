import { describe, expect, it } from "vitest";
import {
  comparisonCandidates,
  comparisonLabels,
  comparisonSearch,
  comparisonTarget,
  isComparing,
  noCandidates,
  resolveComparison,
  UNCOMMITTED,
} from "./comparison.functions.ts";

describe("resolveComparison", () => {
  it("reads the working tree when nothing is asked for and nothing is aimed", () => {
    expect(resolveComparison(undefined, null)).toEqual(UNCOMMITTED);
  });

  it("falls back to where the branch is aimed", () => {
    expect(resolveComparison(undefined, "development")).toEqual({
      kind: "branch",
      against: "development",
    });
  });

  it("takes what was asked for over the aim", () => {
    expect(resolveComparison("main", "development")).toEqual({
      kind: "branch",
      against: "main",
    });
  });

  it("reads an empty request as 'uncommitted only', not as an absent one", () => {
    expect(resolveComparison("", "development")).toEqual(UNCOMMITTED);
  });

  it("ignores refs that are only whitespace", () => {
    expect(resolveComparison("   ", "development")).toEqual(UNCOMMITTED);
    expect(resolveComparison(undefined, "  ")).toEqual(UNCOMMITTED);
  });

  it("trims a ref it is given", () => {
    expect(resolveComparison(" main ", null)).toEqual({
      kind: "branch",
      against: "main",
    });
  });
});

describe("comparisonTarget", () => {
  it("asks for the worktree diff when nothing is compared", () => {
    expect(comparisonTarget(UNCOMMITTED)).toBeNull();
  });

  it("names the branch otherwise", () => {
    expect(comparisonTarget({ kind: "branch", against: "origin/main" })).toBe(
      "origin/main"
    );
  });
});

describe("comparisonSearch", () => {
  it("writes the empty string so the aim cannot answer again", () => {
    expect(comparisonSearch(UNCOMMITTED)).toBe("");
  });

  it("writes the branch when one is compared", () => {
    expect(comparisonSearch({ kind: "branch", against: "main" })).toBe("main");
  });
});

describe("isComparing", () => {
  it("marks 'uncommitted only' when nothing is compared", () => {
    expect(isComparing(UNCOMMITTED, null)).toBe(true);
    expect(isComparing(UNCOMMITTED, "main")).toBe(false);
  });

  it("marks the branch that is on", () => {
    const comparison = { kind: "branch", against: "main" } as const;
    expect(isComparing(comparison, "main")).toBe(true);
    expect(isComparing(comparison, "development")).toBe(false);
    expect(isComparing(comparison, null)).toBe(false);
  });
});

describe("comparisonLabels", () => {
  it("reads the branch against itself-with-changes by default", () => {
    expect(comparisonLabels(UNCOMMITTED, "feature/x")).toEqual({
      base: "feature/x",
      head: "feature/x with changes",
      // The name is on the left already; saying it twice is what makes a
      // header chip unreadable.
      headShort: "with changes",
      summary: "Comparing ‘feature/x’ against ‘feature/x with changes’",
    });
  });

  it("puts the compared branch on the left", () => {
    expect(
      comparisonLabels({ kind: "branch", against: "main" }, "feature/x")
    ).toEqual({
      base: "main",
      head: "feature/x with changes",
      // Two different branches: the right-hand side has to name its own.
      headShort: "feature/x with changes",
      summary: "Comparing ‘main’ against ‘feature/x with changes’",
    });
  });

  it("names a detached head rather than leaving the side blank", () => {
    expect(comparisonLabels(UNCOMMITTED, null).base).toBe("this checkout");
    expect(comparisonLabels(UNCOMMITTED, "  ").head).toBe(
      "this checkout with changes"
    );
  });
});

describe("comparisonCandidates", () => {
  const branches = ["main", "development", "feature/x"];
  const remoteBranches = ["origin/main", "origin/feature/x"];

  it("leaves the checked-out branch out of the local list", () => {
    const { local } = comparisonCandidates({
      branches,
      remoteBranches,
      current: "feature/x",
    });
    expect(local.map((c) => c.ref)).toEqual(["main", "development"]);
  });

  it("keeps the branch's own remote, which is 'what have I not pushed'", () => {
    const { remote } = comparisonCandidates({
      branches,
      remoteBranches,
      current: "feature/x",
    });
    expect(remote.map((c) => c.ref)).toEqual([
      "origin/main",
      "origin/feature/x",
    ]);
  });

  it("marks where the branch's work is aimed", () => {
    const { local } = comparisonCandidates({
      branches,
      remoteBranches,
      current: "feature/x",
      aim: "development",
    });
    expect(local.find((c) => c.ref === "development")?.aimed).toBe(true);
    expect(local.find((c) => c.ref === "main")?.aimed).toBe(false);
  });

  it("searches both lists, case-insensitively", () => {
    const found = comparisonCandidates({
      branches,
      remoteBranches,
      current: "development",
      query: "MAIN",
    });
    expect(found.local.map((c) => c.ref)).toEqual(["main"]);
    expect(found.remote.map((c) => c.ref)).toEqual(["origin/main"]);
    expect(noCandidates(found)).toBe(false);
  });

  it("reports when a search has ruled everything out", () => {
    expect(
      noCandidates(
        comparisonCandidates({
          branches,
          remoteBranches,
          current: null,
          query: "nothing-like-this",
        })
      )
    ).toBe(true);
  });
});
