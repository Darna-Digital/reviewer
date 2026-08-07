import { describe, expect, it } from "vitest";
import { codeRevealSnapshot, requestCodeReveal } from "./code-reveal";

describe("requestCodeReveal", () => {
  it("carries the file and line asked for", () => {
    requestCodeReveal("src/branch.ts", 40);
    expect(codeRevealSnapshot()).toMatchObject({
      path: "src/branch.ts",
      line: 40,
    });
  });

  /**
   * The whole reason this exists. Asking for the line already in the URL leaves
   * the search params untouched, so the shell's params effect never re-runs;
   * the counter is what makes the second ask distinguishable from the first.
   */
  it("counts up even when nothing about the target changed", () => {
    requestCodeReveal("src/branch.ts", 40);
    const first = codeRevealSnapshot()!.key;
    requestCodeReveal("src/branch.ts", 40);
    expect(codeRevealSnapshot()!.key).toBe(first + 1);
  });

  it("counts up across different targets too", () => {
    requestCodeReveal("src/a.ts", 1);
    const first = codeRevealSnapshot()!.key;
    requestCodeReveal("src/b.ts", 9);
    expect(codeRevealSnapshot()).toMatchObject({
      path: "src/b.ts",
      line: 9,
      key: first + 1,
    });
  });
});
