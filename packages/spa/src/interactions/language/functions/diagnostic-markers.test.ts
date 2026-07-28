// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import {
  clearDiagnosticMarks,
  paintDiagnostics,
  SEVERITY_ATTRIBUTE,
  TAG_ATTRIBUTE,
} from "./diagnostic-markers"
import { diagnostic, range } from "./language.functions.mock"

/**
 * The shape `@pierre/diffs` renders with `useTokenTransformer`: one element per
 * line carrying `data-line` (one-based), one per token carrying `data-char`
 * (zero-based column).
 */
const render = (lines: ReadonlyArray<ReadonlyArray<string>>): HTMLElement => {
  const container = document.createElement("div")
  lines.forEach((tokens, index) => {
    const line = document.createElement("div")
    line.setAttribute("data-line", String(index + 1))
    let column = 0
    for (const text of tokens) {
      const span = document.createElement("span")
      span.setAttribute("data-char", String(column))
      span.textContent = text
      line.append(span)
      column += text.length
    }
    container.append(line)
  })
  return container
}

// `const wrong = 1` / `greet(name)`
const DOC = [
  ["const", " ", "wrong", " ", "=", " ", "1"],
  ["greet", "(", "name", ")"],
]

const marked = (container: HTMLElement) =>
  [...container.querySelectorAll(`[${SEVERITY_ATTRIBUTE}]`)].map((element) => ({
    text: element.textContent,
    severity: element.getAttribute(SEVERITY_ATTRIBUTE),
  }))

describe("paintDiagnostics", () => {
  it("underlines only the tokens a diagnostic covers", () => {
    const container = render(DOC)
    // Columns 6–11 on line 1 are `wrong`.
    const count = paintDiagnostics(container, [
      diagnostic({ range: range(0, 6, 0, 11), severity: "error" }),
    ])
    expect(count).toBe(1)
    expect(marked(container)).toEqual([{ text: "wrong", severity: "error" }])
  })

  it("marks every token of a multi-token range", () => {
    const container = render(DOC)
    paintDiagnostics(container, [
      diagnostic({ range: range(1, 0, 1, 11), severity: "warning" }),
    ])
    expect(marked(container).map((entry) => entry.text)).toEqual([
      "greet",
      "(",
      "name",
      ")",
    ])
  })

  it("spans lines", () => {
    const container = render(DOC)
    paintDiagnostics(container, [
      diagnostic({ range: range(0, 6, 1, 5), severity: "error" }),
    ])
    expect(marked(container).map((entry) => entry.text)).toEqual([
      "wrong",
      "=",
      "1",
      "greet",
    ])
  })

  it("skips whitespace tokens so the underline stays on the code", () => {
    const container = render(DOC)
    paintDiagnostics(container, [
      diagnostic({ range: range(0, 0, 0, 15), severity: "error" }),
    ])
    expect(marked(container).map((entry) => entry.text)).toEqual([
      "const",
      "wrong",
      "=",
      "1",
    ])
  })

  it("uses the most severe severity when diagnostics overlap", () => {
    const container = render(DOC)
    paintDiagnostics(container, [
      diagnostic({ range: range(0, 6, 0, 11), severity: "hint" }),
      diagnostic({ range: range(0, 6, 0, 11), severity: "error" }),
    ])
    expect(marked(container)[0].severity).toBe("error")
  })

  it("records tags separately so unused code can be faded", () => {
    const container = render(DOC)
    paintDiagnostics(container, [
      diagnostic({
        range: range(0, 6, 0, 11),
        severity: "hint",
        tags: ["unnecessary"],
      }),
    ])
    const token = container.querySelector(`[${TAG_ATTRIBUTE}]`)
    expect(token?.textContent).toBe("wrong")
    expect(token?.getAttribute(TAG_ATTRIBUTE)).toBe("unnecessary")
  })

  it("puts the message in a title, with the code when there is one", () => {
    const container = render(DOC)
    paintDiagnostics(container, [
      diagnostic({ range: range(0, 6, 0, 11), message: "bad", code: "2322" }),
    ])
    expect(
      container.querySelector(`[${SEVERITY_ATTRIBUTE}]`)?.getAttribute("title")
    ).toBe("bad (ts 2322)")
  })

  it("omits the code when the diagnostic has none", () => {
    const container = render(DOC)
    paintDiagnostics(container, [
      diagnostic({ range: range(0, 6, 0, 11), message: "bad", code: null }),
    ])
    expect(
      container.querySelector(`[${SEVERITY_ATTRIBUTE}]`)?.getAttribute("title")
    ).toBe("bad")
  })

  it("joins several messages on one token", () => {
    const container = render(DOC)
    paintDiagnostics(container, [
      diagnostic({ range: range(0, 6, 0, 11), message: "first", code: null }),
      diagnostic({ range: range(0, 7, 0, 9), message: "second", code: null }),
    ])
    expect(
      container.querySelector(`[${SEVERITY_ATTRIBUTE}]`)?.getAttribute("title")
    ).toBe("first\nsecond")
  })

  it("is idempotent, so a fixed diagnostic leaves no stale mark", () => {
    const container = render(DOC)
    paintDiagnostics(container, [diagnostic({ range: range(0, 6, 0, 11) })])
    expect(marked(container)).toHaveLength(1)

    paintDiagnostics(container, [diagnostic({ range: range(1, 0, 1, 5) })])
    expect(marked(container).map((entry) => entry.text)).toEqual(["greet"])

    paintDiagnostics(container, [])
    expect(marked(container)).toEqual([])
    expect(container.querySelector("[title]")).toBeNull()
  })

  it("ignores lines and tokens with unusable attributes", () => {
    const container = render(DOC)
    container.querySelector("[data-line]")!.setAttribute("data-line", "junk")
    expect(
      paintDiagnostics(container, [diagnostic({ range: range(0, 6, 0, 11) })])
    ).toBe(0)
  })

  it("does nothing when there are no diagnostics", () => {
    const container = render(DOC)
    expect(paintDiagnostics(container, [])).toBe(0)
  })
})

describe("paintDiagnostics across the shadow boundary", () => {
  /**
   * The container `onPostRender` hands back is the `<diffs-container>` host,
   * not its shadow root — painting the host directly finds no lines at all.
   */
  const shadowed = () => {
    const host = document.createElement("diffs-container")
    // The custom element registered by `@pierre/diffs` already has one.
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    shadow.append(...render(DOC).childNodes)
    return host
  }

  it("marks tokens rendered inside the view's shadow root", () => {
    const host = shadowed()
    expect(host.querySelectorAll("[data-line]")).toHaveLength(0)
    expect(
      paintDiagnostics(host, [
        diagnostic({ range: range(0, 6, 0, 11), severity: "error" }),
      ])
    ).toBe(1)
    expect(
      host.shadowRoot!.querySelector(`[${SEVERITY_ATTRIBUTE}]`)?.textContent
    ).toBe("wrong")
  })

  it("clears marks inside the shadow root too", () => {
    const host = shadowed()
    paintDiagnostics(host, [diagnostic({ range: range(0, 6, 0, 11) })])
    clearDiagnosticMarks(host)
    expect(
      host.shadowRoot!.querySelectorAll(`[${SEVERITY_ATTRIBUTE}]`)
    ).toHaveLength(0)
  })
})

describe("clearDiagnosticMarks", () => {
  it("restores the container it was given", () => {
    const container = render(DOC)
    const before = container.innerHTML
    paintDiagnostics(container, [diagnostic({ range: range(0, 6, 0, 11) })])
    expect(container.innerHTML).not.toBe(before)
    clearDiagnosticMarks(container)
    expect(container.innerHTML).toBe(before)
  })
})
