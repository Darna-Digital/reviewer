import { describe, expect, it } from "vitest";
import { applyTextEdits } from "@byconvo/core/language";
import { minimalEdit } from "./format-edit";

const applied = (before: string, after: string) => {
  const edit = minimalEdit(before, after);
  return edit === null ? before : applyTextEdits(before, [edit]);
};

describe("minimalEdit", () => {
  it("has no edit for a document the formatter left alone", () => {
    expect(minimalEdit("const a = 1;\n", "const a = 1;\n")).toBeNull();
  });

  it("covers only the span that moved", () => {
    const edit = minimalEdit(
      "const a = 1\nconst b = 2\n",
      "const a = 1;\nconst b = 2\n"
    );
    expect(edit).toEqual({
      range: {
        start: { line: 0, character: 11 },
        end: { line: 0, character: 11 },
      },
      newText: ";",
    });
  });

  it("describes an insertion at the end of the file", () => {
    expect(minimalEdit("const a = 1;", "const a = 1;\n")).toEqual({
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 12 },
      },
      newText: "\n",
    });
  });

  it("describes a deletion", () => {
    expect(applied("const   a = 1;\n", "const a = 1;\n")).toBe(
      "const a = 1;\n"
    );
  });

  it("rewrites a whole document that shares nothing", () => {
    expect(applied("aaa\n", "bbb\n")).toBe("bbb\n");
  });

  it("never cuts an astral character in half", () => {
    // The two strings share the leading half of the emoji and nothing else.
    const before = "const a = '🎉'";
    const after = "const a = '🎈';";
    expect(applied(before, after)).toBe(after);
  });

  it("round-trips a reflowed file", () => {
    const before = "function f(a,b,c){return a+b+c}\n";
    const after = "function f(a, b, c) {\n  return a + b + c;\n}\n";
    expect(applied(before, after)).toBe(after);
  });
});
