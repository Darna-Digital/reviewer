import { describe, expect, it } from "vitest";
import {
  orderProblems,
  problemOrigin,
  problemPosition,
  problemsLabel,
  problemText,
  problemsText,
} from "./problems.functions";
import { diagnostic, range } from "./language.functions.mock";
import { countDiagnostics } from "./language.functions";

describe("orderProblems", () => {
  it("puts errors ahead of milder severities", () => {
    const hint = diagnostic({ severity: "hint", range: range(0, 0) });
    const warning = diagnostic({ severity: "warning", range: range(1, 0) });
    const error = diagnostic({ severity: "error", range: range(9, 0) });
    expect(orderProblems([hint, warning, error])).toEqual([
      error,
      warning,
      hint,
    ]);
  });

  it("keeps one severity in file order — line, then column", () => {
    const late = diagnostic({ range: range(4, 0) });
    const earlySecond = diagnostic({ range: range(1, 8) });
    const earlyFirst = diagnostic({ range: range(1, 2) });
    expect(orderProblems([late, earlySecond, earlyFirst])).toEqual([
      earlyFirst,
      earlySecond,
      late,
    ]);
  });

  it("leaves the given array untouched", () => {
    const problems = [
      diagnostic({ severity: "hint" }),
      diagnostic({ severity: "error" }),
    ];
    orderProblems(problems);
    expect(problems[0].severity).toBe("hint");
  });
});

describe("problemPosition", () => {
  // The wire format is zero-based on both axes; editors print one-based.
  it("prints the one-based line and column", () => {
    expect(problemPosition(diagnostic({ range: range(11, 4) }))).toBe("12:5");
  });
});

describe("problemOrigin", () => {
  it("names the tool and its code", () => {
    expect(problemOrigin(diagnostic({ source: "ts", code: "2322" }))).toBe(
      "ts(2322)"
    );
  });
  it("names the tool alone when the diagnostic carries no code", () => {
    expect(problemOrigin(diagnostic({ source: "eslint", code: null }))).toBe(
      "eslint"
    );
  });
});

describe("problemsLabel", () => {
  it("lists what is present, worst first", () => {
    const counts = countDiagnostics([
      diagnostic({ severity: "warning" }),
      diagnostic({ severity: "error" }),
      diagnostic({ severity: "error" }),
      diagnostic({ severity: "hint" }),
    ]);
    expect(problemsLabel(counts)).toBe("2 errors, 1 warning, 1 hint");
  });

  it("singularises a count of one", () => {
    expect(problemsLabel(countDiagnostics([diagnostic()]))).toBe("1 error");
  });

  it("says so when the file is clean", () => {
    expect(problemsLabel(countDiagnostics([]))).toBe("No problems");
  });
});

describe("problemText", () => {
  it("prints one problem the way tsc does", () => {
    const problem = diagnostic({
      severity: "error",
      range: range(11, 4),
      source: "ts",
      code: "2322",
      message: "Type 'string' is not assignable to type 'number'.",
    });
    expect(problemText(problem, "src/main.ts")).toBe(
      "src/main.ts:12:5 - error ts(2322): Type 'string' is not assignable to type 'number'."
    );
  });

  it("leaves the path out when the bar does not know it", () => {
    const problem = diagnostic({ range: range(0, 0), message: "Oops." });
    expect(problemText(problem)).toMatch(/^1:1 - /);
  });
});

describe("problemsText", () => {
  it("lists every problem worst first, one per line", () => {
    const hint = diagnostic({
      severity: "hint",
      range: range(0, 0),
      message: "Hint.",
    });
    const error = diagnostic({
      severity: "error",
      range: range(3, 0),
      message: "Error.",
    });
    expect(problemsText([hint, error], "a.ts")).toBe(
      [
        "a.ts:4:1 - error ts(2322): Error.",
        "a.ts:1:1 - hint ts(2322): Hint.",
      ].join("\n")
    );
  });
});
