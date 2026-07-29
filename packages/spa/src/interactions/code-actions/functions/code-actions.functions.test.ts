import { describe, expect, it } from "vitest"
import {
  availableActions,
  createCodeActionsFunctions,
  lineCount,
  normalizeRange,
  selectionSummary,
  targetLine,
} from "./code-actions.functions"
import { mockCodeActionsDependencies } from "./code-actions.functions.mock"

describe("normalizeRange", () => {
  it("passes a downward selection through", () => {
    expect(normalizeRange({ start: 4, end: 9 })).toEqual({ start: 4, end: 9 })
  })
  it("orders an upward selection", () => {
    expect(normalizeRange({ start: 9, end: 4 })).toEqual({ start: 4, end: 9 })
  })
  it("keeps a single-line selection", () => {
    expect(normalizeRange({ start: 7, end: 7 })).toEqual({ start: 7, end: 7 })
  })
  it("returns null when there is no selection", () => {
    expect(normalizeRange(null)).toBeNull()
    expect(normalizeRange(undefined)).toBeNull()
  })
  it("rejects a range below the first line", () => {
    expect(normalizeRange({ start: 0, end: 3 })).toBeNull()
    expect(normalizeRange({ start: -2, end: -1 })).toBeNull()
  })
  it("rejects non-finite bounds", () => {
    expect(normalizeRange({ start: Number.NaN, end: 3 })).toBeNull()
    expect(
      normalizeRange({ start: 1, end: Number.POSITIVE_INFINITY })
    ).toBeNull()
  })
  it("ignores the side fields the view may add", () => {
    expect(normalizeRange({ start: 2, end: 5, side: "additions" })).toEqual({
      start: 2,
      end: 5,
    })
  })
})

describe("lineCount / selectionSummary", () => {
  it("counts inclusively", () => {
    expect(lineCount({ start: 4, end: 4 })).toBe(1)
    expect(lineCount({ start: 4, end: 9 })).toBe(6)
  })
  it("names a single line", () => {
    expect(selectionSummary({ start: 12, end: 12 })).toBe("Line 12")
  })
  it("names a range", () => {
    expect(selectionSummary({ start: 12, end: 18 })).toBe("Lines 12–18")
  })
})

describe("availableActions", () => {
  it("offers what the view supports", () => {
    expect(availableActions({ comment: true }).map((a) => a.id)).toEqual([
      "comment",
    ])
  })
  it("drops what the view cannot do", () => {
    expect(availableActions({ comment: false })).toEqual([])
  })
  it("labels each action", () => {
    const [comment] = availableActions({ comment: true })
    expect(comment).toEqual({ id: "comment", label: "Comment", shortcut: "" })
  })
})

describe("targetLine", () => {
  it("anchors a comment to the last selected line", () => {
    expect(targetLine("comment", { start: 4, end: 9 })).toBe(9)
  })
})

describe("run", () => {
  it("starts a comment on the last selected line", () => {
    const { deps, calls } = mockCodeActionsDependencies()
    expect(
      createCodeActionsFunctions(deps).run("comment", { start: 4, end: 9 })
    ).toBe(true)
    expect(calls.comment).toEqual([9])
  })

  it("refuses an action the view does not support", () => {
    const { deps, calls } = mockCodeActionsDependencies({ comment: false })
    expect(
      createCodeActionsFunctions(deps).run("comment", { start: 1, end: 1 })
    ).toBe(false)
    expect(calls.comment).toEqual([])
  })
})
