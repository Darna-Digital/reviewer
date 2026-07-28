import { describe, expect, it } from "vitest"
import {
  lineCount,
  lineStarts,
  offsetAt,
  positionAt,
  previewAt,
  rangeContains,
  rangeFromSpan,
} from "./language.positions.ts"

const LF = "const a = 1\nconst b = 2\nconst c = 3"
const CRLF = "const a = 1\r\nconst b = 2\r\n"

describe("lineStarts", () => {
  it("starts at zero for an empty string", () => {
    expect(lineStarts("")).toEqual([0])
    expect(lineCount("")).toBe(1)
  })
  it("finds the offset after each LF", () => {
    expect(lineStarts(LF)).toEqual([0, 12, 24])
  })
  it("counts a CRLF pair once, after the LF", () => {
    expect(lineStarts(CRLF)).toEqual([0, 13, 26])
  })
  it("treats a lone CR as a terminator", () => {
    expect(lineStarts("a\rb")).toEqual([0, 2])
  })
  it("opens an empty final line after a trailing newline", () => {
    expect(lineCount("a\n")).toBe(2)
    expect(positionAt("a\n", 2)).toEqual({ line: 1, character: 0 })
  })
})

describe("offsetAt / positionAt", () => {
  it("round-trips every offset in an LF document", () => {
    for (let offset = 0; offset <= LF.length; offset++) {
      expect(offsetAt(LF, positionAt(LF, offset))).toBe(offset)
    }
  })
  it("round-trips every offset in a CRLF document", () => {
    for (let offset = 0; offset <= CRLF.length; offset++) {
      const position = positionAt(CRLF, offset)
      // Offsets inside a CRLF pair clamp to the end of the line's text.
      expect(offsetAt(CRLF, position)).toBeLessThanOrEqual(offset)
    }
  })
  it("maps a mid-line position to its offset", () => {
    expect(offsetAt(LF, { line: 1, character: 6 })).toBe(18)
    expect(positionAt(LF, 18)).toEqual({ line: 1, character: 6 })
  })
  it("clamps a character past the end of its line", () => {
    // Line 0 is 11 characters; the newline is not addressable.
    expect(offsetAt(LF, { line: 0, character: 999 })).toBe(11)
  })
  it("clamps a character past the end of a CRLF line", () => {
    expect(offsetAt(CRLF, { line: 0, character: 999 })).toBe(11)
  })
  it("clamps a line past the end of the document", () => {
    expect(offsetAt(LF, { line: 99, character: 0 })).toBe(24)
  })
  it("clamps negative input", () => {
    expect(offsetAt(LF, { line: -3, character: -3 })).toBe(0)
    expect(positionAt(LF, -5)).toEqual({ line: 0, character: 0 })
    expect(positionAt(LF, 10_000)).toEqual({ line: 2, character: 11 })
  })
  it("counts astral characters as UTF-16 code units, like LSP", () => {
    const text = "const e = '😀'"
    // The emoji is a surrogate pair, so the closing quote sits two units later.
    expect(positionAt(text, text.length)).toEqual({
      line: 0,
      character: text.length,
    })
    expect(offsetAt(text, { line: 0, character: 12 })).toBe(12)
  })
})

describe("rangeFromSpan", () => {
  it("converts a start/length span", () => {
    expect(rangeFromSpan(LF, 12, 5)).toEqual({
      start: { line: 1, character: 0 },
      end: { line: 1, character: 5 },
    })
  })
  it("treats a negative length as empty", () => {
    const range = rangeFromSpan(LF, 12, -4)
    expect(range.start).toEqual(range.end)
  })
})

describe("previewAt", () => {
  it("returns the trimmed line", () => {
    expect(previewAt("  indented  \nnext", 0)).toBe("indented")
  })
  it("returns an empty string out of range", () => {
    expect(previewAt(LF, 99)).toBe("")
    expect(previewAt(LF, -1)).toBe("")
  })
  it("truncates a very long line", () => {
    const preview = previewAt("x".repeat(500), 0)
    expect(preview).toHaveLength(201)
    expect(preview.endsWith("…")).toBe(true)
  })
  it("excludes the CR of a CRLF line", () => {
    expect(previewAt(CRLF, 0)).toBe("const a = 1")
  })
})

describe("rangeContains", () => {
  const range = {
    start: { line: 1, character: 4 },
    end: { line: 2, character: 3 },
  }
  it("includes the start and excludes the end", () => {
    expect(rangeContains(range, { line: 1, character: 4 })).toBe(true)
    expect(rangeContains(range, { line: 2, character: 2 })).toBe(true)
    expect(rangeContains(range, { line: 2, character: 3 })).toBe(false)
    expect(rangeContains(range, { line: 1, character: 3 })).toBe(false)
  })
  it("excludes lines outside the range", () => {
    expect(rangeContains(range, { line: 0, character: 9 })).toBe(false)
    expect(rangeContains(range, { line: 3, character: 0 })).toBe(false)
  })
  it("makes an empty range contain its own start", () => {
    const empty = {
      start: { line: 5, character: 2 },
      end: { line: 5, character: 2 },
    }
    expect(rangeContains(empty, { line: 5, character: 2 })).toBe(true)
    expect(rangeContains(empty, { line: 5, character: 3 })).toBe(false)
  })
})
