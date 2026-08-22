import { describe, expect, it } from "vitest";
import { commentLineFor, selectionSummary } from "./selection-anchor";

const span = (
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number
) => ({
  start: { line: startLine, character: startCharacter },
  end: { line: endLine, character: endCharacter },
});

describe("commentLineFor", () => {
  it("files a comment against the last line the selection covers", () => {
    // Zero-based in, one-based out.
    expect(commentLineFor(span(2, 0, 5, 4))).toBe(6);
  });

  it("stops short of a line the selection only reaches the start of", () => {
    // Dragging to column zero of line 5 means "everything above it".
    expect(commentLineFor(span(2, 0, 5, 0))).toBe(5);
  });

  it("reads a selection dragged upwards the same way as one dragged down", () => {
    expect(commentLineFor(span(5, 4, 2, 0))).toBe(6);
  });

  it("files a selection within one line against that line", () => {
    expect(commentLineFor(span(7, 2, 7, 30))).toBe(8);
  });

  it("keeps a single line selected to its very start", () => {
    // Not the column-zero rule: there is no line above to hand it to.
    expect(commentLineFor(span(3, 0, 3, 0))).toBeNull();
    expect(commentLineFor(span(3, 0, 4, 0))).toBe(4);
  });

  it("has nothing to say about a caret", () => {
    expect(commentLineFor(span(4, 6, 4, 6))).toBeNull();
  });
});

describe("selectionSummary", () => {
  it("flattens a passage onto one line", () => {
    expect(selectionSummary("  const a = 1;\n  const b = 2;")).toBe(
      "const a = 1; const b = 2;"
    );
  });

  it("truncates a long one", () => {
    expect(selectionSummary("x".repeat(80), 10)).toBe("xxxxxxxxx…");
  });

  it("has nothing to show for whitespace", () => {
    expect(selectionSummary("   \n  ")).toBe("");
  });
});
