import { describe, expect, it } from "vitest"
import type { CompletionItem } from "../schema/language.schema.ts"
import {
  filterCompletions,
  identifierAt,
  matchTier,
  prefixAt,
} from "./language.completions.ts"

const item = (
  label: string,
  over: Partial<CompletionItem> = {}
): CompletionItem => ({
  label,
  kind: "function",
  detail: "",
  insertText: label,
  sortText: "11",
  source: "",
  data: null,
  ...over,
})

describe("matchTier", () => {
  it("ranks an exact prefix highest", () => {
    expect(matchTier("greetSomeone", "greet")).toBe("exact-prefix")
  })
  it("accepts a case-insensitive prefix", () => {
    expect(matchTier("greetSomeone", "GREET")).toBe("prefix")
    expect(matchTier("GreetSomeone", "greet")).toBe("prefix")
  })
  it("accepts a subsequence, as camel-case matching does", () => {
    expect(matchTier("greetSomeone", "gso")).toBe("subsequence")
    expect(matchTier("readFileSync", "rfs")).toBe("subsequence")
  })
  it("rejects characters out of order", () => {
    expect(matchTier("greetSomeone", "zx")).toBe("none")
    // No `g` follows the first `e`, so the characters are not in order.
    expect(matchTier("greetSomeone", "eg")).toBe("none")
    expect(matchTier("abc", "cba")).toBe("none")
  })
  it("treats an empty prefix as matching everything", () => {
    expect(matchTier("anything", "")).toBe("exact-prefix")
  })
})

describe("filterCompletions", () => {
  it("keeps only what matches", () => {
    const kept = filterCompletions(
      [item("greetSomeone"), item("farewell"), item("greeting")],
      "greet"
    )
    // Alphabetical within a tier, not the order the provider happened to use.
    expect(kept.map((entry) => entry.label)).toEqual([
      "greeting",
      "greetSomeone",
    ])
  })

  it("puts better tiers first", () => {
    const kept = filterCompletions(
      [item("getGreeter"), item("GreetLoudly"), item("greetSomeone")],
      "greet"
    )
    expect(kept.map((entry) => entry.label)).toEqual([
      "greetSomeone",
      "GreetLoudly",
      "getGreeter",
    ])
  })

  it("prefers a symbol in scope over one needing an import", () => {
    const kept = filterCompletions(
      [
        item("greetSomeone", { source: "./lib" }),
        item("greetSomeone", { sortText: "11" }),
      ],
      "greet"
    )
    expect(kept[0].source).toBe("")
  })

  it("respects the provider's own ordering within a tier", () => {
    const kept = filterCompletions(
      [item("greetB", { sortText: "15" }), item("greetA", { sortText: "11" })],
      "greet"
    )
    expect(kept.map((entry) => entry.label)).toEqual(["greetA", "greetB"])
  })

  it("caps the list", () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      item(`greet${String(i).padStart(3, "0")}`)
    )
    const kept = filterCompletions(many, "greet", 10)
    expect(kept).toHaveLength(10)
    expect(kept[0].label).toBe("greet000")
  })

  it("returns everything (capped) for an empty prefix", () => {
    const kept = filterCompletions([item("a"), item("b")], "")
    expect(kept).toHaveLength(2)
  })

  it("handles an empty list", () => {
    expect(filterCompletions([], "x")).toEqual([])
  })
})

describe("prefixAt", () => {
  it("takes the identifier before the caret", () => {
    expect(prefixAt("  const greetSo", 15)).toBe("greetSo")
  })
  it("is empty right after punctuation", () => {
    expect(prefixAt("who.", 4)).toBe("")
    expect(prefixAt("foo(", 4)).toBe("")
  })
  it("stops at the caret, ignoring what follows", () => {
    // Ten characters in is `const gree`.
    expect(prefixAt("const greeting = 1", 10)).toBe("gree")
  })
  it("accepts identifier characters other than letters", () => {
    expect(prefixAt("const $el_2", 11)).toBe("$el_2")
  })
  it("handles the start of a line", () => {
    expect(prefixAt("greet", 0)).toBe("")
    expect(prefixAt("", 0)).toBe("")
  })
  it("clamps a character past the end of the line", () => {
    expect(prefixAt("greet", 99)).toBe("greet")
  })
})

describe("identifierAt", () => {
  const text = "const greetSomeone = 1\nreturn other$name_2\n"

  it("finds the identifier the caret sits inside", () => {
    expect(identifierAt(text, 9)).toEqual({
      text: "greetSomeone",
      start: 6,
      end: 18,
    })
  })
  it("finds it from either edge", () => {
    expect(identifierAt(text, 6)?.text).toBe("greetSomeone")
    expect(identifierAt(text, 18)?.text).toBe("greetSomeone")
  })
  it("includes $ and digits", () => {
    expect(identifierAt(text, 32)?.text).toBe("other$name_2")
  })
  it("returns null between words", () => {
    // Offset 19 is the space before `=`, with no word character on either side.
    expect(identifierAt(text, 19)).toBeNull()
    expect(identifierAt("a = b", 2)).toBeNull()
  })
  it("clamps out-of-range offsets", () => {
    expect(identifierAt(text, -5)?.text).toBe("const")
    expect(identifierAt(text, 9_999)).toBeNull()
  })
  it("handles an empty document", () => {
    expect(identifierAt("", 0)).toBeNull()
  })
})
