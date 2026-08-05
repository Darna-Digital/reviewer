import { describe, expect, it } from "vitest";
import type { TextEdit } from "../schema/language.schema.ts";
import { applyTextEdits } from "./language.edits.ts";

const edit = (
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number,
  newText: string
): TextEdit => ({
  range: {
    start: { line: startLine, character: startCharacter },
    end: { line: endLine, character: endCharacter },
  },
  newText,
});

const DOC = "const a = 1\nconst b = 2\nconst c = 3\n";

describe("applyTextEdits", () => {
  it("returns the text unchanged for no edits", () => {
    expect(applyTextEdits(DOC, [])).toBe(DOC);
  });

  it("applies a single replacement", () => {
    expect(applyTextEdits(DOC, [edit(1, 6, 1, 7, "bee")])).toBe(
      "const a = 1\nconst bee = 2\nconst c = 3\n"
    );
  });

  it("inserts at a zero-width range, as an added import does", () => {
    expect(
      applyTextEdits(DOC, [edit(0, 0, 0, 0, 'import x from "y"\n\n')])
    ).toBe('import x from "y"\n\nconst a = 1\nconst b = 2\nconst c = 3\n');
  });

  it("applies several edits without their offsets drifting", () => {
    // Both are computed against the original text; a naive front-to-back pass
    // would apply the second at the wrong place.
    const result = applyTextEdits(DOC, [
      edit(0, 6, 0, 7, "alpha"),
      edit(2, 6, 2, 7, "gamma"),
    ]);
    expect(result).toBe("const alpha = 1\nconst b = 2\nconst gamma = 3\n");
  });

  it("does not depend on the order the edits arrive in", () => {
    const forwards = applyTextEdits(DOC, [
      edit(0, 6, 0, 7, "alpha"),
      edit(2, 6, 2, 7, "gamma"),
    ]);
    const backwards = applyTextEdits(DOC, [
      edit(2, 6, 2, 7, "gamma"),
      edit(0, 6, 0, 7, "alpha"),
    ]);
    expect(backwards).toBe(forwards);
  });

  it("applies a multi-line replacement", () => {
    expect(applyTextEdits(DOC, [edit(0, 0, 2, 0, "")])).toBe("const c = 3\n");
  });

  it("drops an edit overlapping one already applied", () => {
    const result = applyTextEdits(DOC, [
      edit(0, 0, 0, 11, "first"),
      edit(0, 6, 0, 7, "second"),
    ]);
    expect(result).toBe("first\nconst b = 2\nconst c = 3\n");
  });

  it("keeps two insertions at the same point", () => {
    const result = applyTextEdits("ab", [
      edit(0, 1, 0, 1, "X"),
      edit(0, 1, 0, 1, "Y"),
    ]);
    // Neither is dropped (both are zero-width), and applying from the end
    // leaves them in the order they were given.
    expect(result).toBe("aXYb");
  });

  it("clamps an edit past the end of the document", () => {
    expect(applyTextEdits("ab", [edit(9, 9, 9, 9, "!")])).toBe("ab!");
  });
});
