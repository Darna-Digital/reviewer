import { describe, expect, it } from "vitest"
import type { TokenSpan } from "../interfaces/language.interfaces"
import {
  countDiagnostics,
  createLanguageFunctions,
  groupDiagnosticsByLine,
  isNavigableToken,
  lineOfDiagnostic,
  markerForToken,
  positionOfToken,
  rangeTouchesToken,
  targetsSameToken,
} from "./language.functions"
import {
  diagnostic,
  mockLanguageDependencies,
  range,
  reference,
  target,
} from "./language.functions.mock"

/** `greet` on editor line 5, columns 16–21. */
const token: TokenSpan = {
  lineNumber: 5,
  lineCharStart: 16,
  lineCharEnd: 21,
  tokenText: "greet",
}

describe("positionOfToken", () => {
  it("converts one-based editor lines to zero-based protocol lines", () => {
    expect(positionOfToken(token)).toEqual({ line: 4, character: 16 })
  })
  it("never produces a negative position", () => {
    expect(
      positionOfToken({ ...token, lineNumber: 0, lineCharStart: -2 })
    ).toEqual({ line: 0, character: 0 })
  })
})

describe("isNavigableToken", () => {
  it("accepts identifiers", () => {
    expect(isNavigableToken("greet")).toBe(true)
    expect(isNavigableToken("_private")).toBe(true)
    expect(isNavigableToken("$el")).toBe(true)
    expect(isNavigableToken("useState2")).toBe(true)
  })
  it("accepts identifiers in other scripts", () => {
    expect(isNavigableToken("naïve")).toBe(true)
    expect(isNavigableToken("переменная")).toBe(true)
  })
  it("rejects punctuation, whitespace and literals", () => {
    expect(isNavigableToken("(")).toBe(false)
    expect(isNavigableToken(" ")).toBe(false)
    expect(isNavigableToken("")).toBe(false)
    expect(isNavigableToken("42")).toBe(false)
    expect(isNavigableToken("=>")).toBe(false)
    expect(isNavigableToken('"text"')).toBe(false)
  })
  it("rejects a token with trailing punctuation", () => {
    expect(isNavigableToken("greet(")).toBe(false)
  })
})

describe("lineOfDiagnostic", () => {
  it("converts back to the editor's one-based line", () => {
    expect(lineOfDiagnostic(diagnostic({ range: range(4, 0) }))).toBe(5)
  })
})

describe("rangeTouchesToken", () => {
  it("matches a range covering part of the token", () => {
    expect(rangeTouchesToken(range(4, 18, 4, 20), token)).toBe(true)
  })
  it("matches a range exactly on the token", () => {
    expect(rangeTouchesToken(range(4, 16, 4, 21), token)).toBe(true)
  })
  it("excludes a range ending where the token starts", () => {
    expect(rangeTouchesToken(range(4, 10, 4, 16), token)).toBe(false)
  })
  it("excludes a range starting where the token ends", () => {
    expect(rangeTouchesToken(range(4, 21, 4, 30), token)).toBe(false)
  })
  it("excludes another line", () => {
    expect(rangeTouchesToken(range(3, 16, 3, 21), token)).toBe(false)
    expect(rangeTouchesToken(range(5, 16, 5, 21), token)).toBe(false)
  })
  it("matches a multi-line range covering the token's line entirely", () => {
    expect(rangeTouchesToken(range(2, 30, 7, 2), token)).toBe(true)
  })
  it("respects the column bounds on the range's first line", () => {
    expect(rangeTouchesToken(range(4, 21, 6, 0), token)).toBe(false)
    expect(rangeTouchesToken(range(4, 20, 6, 0), token)).toBe(true)
  })
  it("respects the column bounds on the range's last line", () => {
    expect(rangeTouchesToken(range(2, 0, 4, 16), token)).toBe(false)
    expect(rangeTouchesToken(range(2, 0, 4, 17), token)).toBe(true)
  })
  it("treats an empty range as covering the character it sits on", () => {
    expect(rangeTouchesToken(range(4, 18, 4, 18), token)).toBe(true)
    expect(rangeTouchesToken(range(4, 30, 4, 30), token)).toBe(false)
  })
  it("still marks a zero-width token from an empty range", () => {
    const empty: TokenSpan = { ...token, lineCharEnd: 16 }
    expect(rangeTouchesToken(range(4, 16, 4, 16), empty)).toBe(true)
  })
})

describe("groupDiagnosticsByLine", () => {
  it("keys by the one-based line the range starts on", () => {
    const grouped = groupDiagnosticsByLine([
      diagnostic({ range: range(0, 0) }),
      diagnostic({ range: range(4, 2) }),
    ])
    expect([...grouped.keys()].sort((a, b) => a - b)).toEqual([1, 5])
  })
  it("anchors a multi-line diagnostic to its first line only", () => {
    const grouped = groupDiagnosticsByLine([
      diagnostic({ range: range(1, 0, 6, 4) }),
    ])
    expect([...grouped.keys()]).toEqual([2])
  })
  it("puts the most severe diagnostic first within a line", () => {
    const grouped = groupDiagnosticsByLine([
      diagnostic({ range: range(0, 0), severity: "hint" }),
      diagnostic({ range: range(0, 4), severity: "error" }),
      diagnostic({ range: range(0, 8), severity: "warning" }),
    ])
    expect(grouped.get(1)!.map((entry) => entry.severity)).toEqual([
      "error",
      "warning",
      "hint",
    ])
  })
})

describe("markerForToken", () => {
  it("returns null when nothing touches the token", () => {
    expect(
      markerForToken([diagnostic({ range: range(0, 0) })], token)
    ).toBeNull()
  })
  it("promotes the most severe overlapping severity", () => {
    const marker = markerForToken(
      [
        diagnostic({ range: range(4, 16, 4, 21), severity: "hint" }),
        diagnostic({ range: range(4, 18, 4, 19), severity: "warning" }),
      ],
      token
    )
    expect(marker?.severity).toBe("warning")
    expect(marker?.diagnostics).toHaveLength(2)
  })
  it("unions the tags of everything touching the token", () => {
    const marker = markerForToken(
      [
        diagnostic({ range: range(4, 16, 4, 21), tags: ["unnecessary"] }),
        diagnostic({ range: range(4, 16, 4, 21), tags: ["deprecated"] }),
      ],
      token
    )
    expect(marker?.tags).toEqual(["unnecessary", "deprecated"])
  })
  it("does not repeat a tag reported twice", () => {
    const marker = markerForToken(
      [
        diagnostic({ range: range(4, 16, 4, 21), tags: ["unnecessary"] }),
        diagnostic({ range: range(4, 17, 4, 19), tags: ["unnecessary"] }),
      ],
      token
    )
    expect(marker?.tags).toEqual(["unnecessary"])
  })
})

describe("countDiagnostics", () => {
  it("counts by severity", () => {
    expect(
      countDiagnostics([
        diagnostic({ severity: "error" }),
        diagnostic({ severity: "error" }),
        diagnostic({ severity: "warning" }),
        diagnostic({ severity: "information" }),
        diagnostic({ severity: "hint" }),
      ])
    ).toEqual({ errors: 2, warnings: 1, infos: 1, hints: 1 })
  })
  it("counts nothing for an empty list", () => {
    expect(countDiagnostics([])).toEqual({
      errors: 0,
      warnings: 0,
      infos: 0,
      hints: 0,
    })
  })
})

describe("targetsSameToken", () => {
  it("recognises the token the user clicked", () => {
    expect(
      targetsSameToken(
        { location: { path: "src/a.ts", range: range(4, 16, 4, 21) } },
        "src/a.ts",
        token
      )
    ).toBe(true)
  })
  it("rejects a different file or position", () => {
    expect(
      targetsSameToken(
        { location: { path: "src/b.ts", range: range(4, 16, 4, 21) } },
        "src/a.ts",
        token
      )
    ).toBe(false)
    expect(
      targetsSameToken(
        { location: { path: "src/a.ts", range: range(9, 16, 9, 21) } },
        "src/a.ts",
        token
      )
    ).toBe(false)
  })
})

describe("navigate", () => {
  it("opens the single definition of a usage", async () => {
    const { deps, calls } = mockLanguageDependencies({ targets: [target()] })
    const outcome = await createLanguageFunctions(deps).navigate(
      "src/b.ts",
      token
    )
    expect(outcome).toEqual({ kind: "open", target: target() })
    expect(calls.definition).toEqual([
      { path: "src/b.ts", position: { line: 4, character: 16 } },
    ])
    // No need to ask for usages when there is somewhere to jump.
    expect(calls.references).toEqual([])
  })

  it("offers a choice when a symbol has several declarations", async () => {
    const targets = [
      target(),
      target({ location: { path: "src/c.ts", range: range(1, 0, 1, 5) } }),
    ]
    const { deps } = mockLanguageDependencies({ targets })
    const outcome = await createLanguageFunctions(deps).navigate(
      "src/b.ts",
      token
    )
    expect(outcome).toEqual({ kind: "choose", targets })
  })

  it("lists usages when the click lands on the declaration itself", async () => {
    const declaration = target({
      location: { path: "src/a.ts", range: range(4, 16, 4, 21) },
    })
    const { deps, calls } = mockLanguageDependencies({
      targets: [declaration],
      references: [reference(), reference({ kind: "definition" })],
    })
    const outcome = await createLanguageFunctions(deps).navigate(
      "src/a.ts",
      token
    )
    expect(outcome).toMatchObject({ kind: "usages", symbol: "greet" })
    expect(calls.references).toHaveLength(1)
  })

  it("falls back to usages when there is no definition to jump to", async () => {
    const { deps } = mockLanguageDependencies({
      targets: [],
      references: [reference()],
    })
    const outcome = await createLanguageFunctions(deps).navigate(
      "src/b.ts",
      token
    )
    expect(outcome).toMatchObject({ kind: "usages" })
  })

  it("uses the token's own text when the provider names no symbol", async () => {
    const { deps } = mockLanguageDependencies({
      targets: [],
      references: [reference()],
      symbol: null,
    })
    const outcome = await createLanguageFunctions(deps).navigate(
      "src/b.ts",
      token
    )
    expect(outcome).toMatchObject({ kind: "usages", symbol: "greet" })
  })

  it("resolves to nothing when there is neither a definition nor a usage", async () => {
    const { deps } = mockLanguageDependencies({ targets: [], references: [] })
    const outcome = await createLanguageFunctions(deps).navigate(
      "src/b.ts",
      token
    )
    expect(outcome).toEqual({ kind: "none" })
  })
})

describe("describe", () => {
  it("asks for hover at the token's position", async () => {
    const { deps, calls } = mockLanguageDependencies()
    const hover = await createLanguageFunctions(deps).describe(
      "src/b.ts",
      token
    )
    expect(hover.contents).toContain("const a: number")
    expect(calls.hover).toEqual([
      { path: "src/b.ts", position: { line: 4, character: 16 } },
    ])
  })
})
