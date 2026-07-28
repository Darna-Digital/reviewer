// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import {
  createSelectionActionElement,
  linesOfSelection,
} from "./selection-action-element"

const at = (
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number
) => ({
  start: { line: startLine, character: startCharacter },
  end: { line: endLine, character: endCharacter },
})

describe("linesOfSelection", () => {
  it("converts a caret to its own one-based line", () => {
    expect(linesOfSelection(at(4, 2, 4, 2))).toEqual({ start: 5, end: 5 })
  })

  it("converts a selection within one line", () => {
    expect(linesOfSelection(at(4, 2, 4, 9))).toEqual({ start: 5, end: 5 })
  })

  it("covers every line a multi-line selection touches", () => {
    expect(linesOfSelection(at(2, 4, 6, 3))).toEqual({ start: 3, end: 7 })
  })

  it("excludes a trailing line the selection only reaches the start of", () => {
    // Dragging from line 3 to the very start of line 7 highlights 3–6.
    expect(linesOfSelection(at(2, 4, 6, 0))).toEqual({ start: 3, end: 6 })
  })

  it("handles an upward selection", () => {
    expect(linesOfSelection(at(6, 3, 2, 4))).toEqual({ start: 3, end: 7 })
  })

  it("excludes the trailing line of an upward selection too", () => {
    expect(linesOfSelection(at(6, 0, 2, 4))).toEqual({ start: 3, end: 6 })
  })

  it("keeps a single line that merely starts at column 0", () => {
    expect(linesOfSelection(at(4, 0, 4, 0))).toEqual({ start: 5, end: 5 })
  })
})

describe("createSelectionActionElement", () => {
  const build = (onSelect = vi.fn()) => ({
    onSelect,
    element: createSelectionActionElement("Lines 3–6", [
      { label: "Comment", shortcut: "C", onSelect },
    ]),
  })

  it("labels itself for assistive technology", () => {
    const { element } = build()
    expect(element.getAttribute("role")).toBe("toolbar")
    expect(element.getAttribute("aria-label")).toBe("Actions for Lines 3–6")
    expect(element.textContent).toContain("Lines 3–6")
  })

  it("renders a button per action with its shortcut", () => {
    const { element } = build()
    const button = element.querySelector("button")
    expect(button?.textContent).toBe("CommentC")
    expect(button?.querySelector("kbd")?.textContent).toBe("C")
  })

  it("omits the shortcut chip when there is none", () => {
    const element = createSelectionActionElement("Line 1", [
      { label: "Comment", shortcut: "", onSelect: vi.fn() },
    ])
    expect(element.querySelector("kbd")).toBeNull()
  })

  it("runs the action on click", () => {
    const { element, onSelect } = build()
    element.querySelector("button")!.click()
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it("keeps the selection alive when the bar is pressed", () => {
    const { element } = build()
    const event = new Event("pointerdown", { cancelable: true, bubbles: true })
    element.querySelector("button")!.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it("renders a bar with no actions at all", () => {
    const element = createSelectionActionElement("Line 1", [])
    expect(element.querySelectorAll("button")).toHaveLength(0)
  })
})
