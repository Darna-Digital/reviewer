import { describe, expect, it } from "vitest"
import {
  basenameOf,
  extensionOf,
  parsePositionQuery,
  patternMatches,
  selectProvider,
} from "./language.registry.ts"

describe("basenameOf / extensionOf", () => {
  it("takes the last path segment", () => {
    expect(basenameOf("src/lib/a.ts")).toBe("a.ts")
    expect(basenameOf("a.ts")).toBe("a.ts")
    expect(basenameOf("src\\lib\\a.ts")).toBe("a.ts")
  })
  it("lowercases the extension", () => {
    expect(extensionOf("src/A.TS")).toBe(".ts")
  })
  it("reports the last extension of a compound name", () => {
    expect(extensionOf("src/index.d.ts")).toBe(".ts")
  })
  it("treats a dotfile as extension-less", () => {
    expect(extensionOf(".gitignore")).toBe("")
    expect(extensionOf("src/.env")).toBe("")
  })
  it("returns an empty string when there is no dot", () => {
    expect(extensionOf("Makefile")).toBe("")
    expect(extensionOf("")).toBe("")
  })
  it("is not fooled by a dot in a directory name", () => {
    expect(extensionOf("v1.2/Dockerfile")).toBe("")
  })
})

describe("patternMatches", () => {
  it("matches extensions case-insensitively", () => {
    expect(patternMatches(".ts", "src/a.ts")).toBe(true)
    expect(patternMatches(".TS", "src/a.ts")).toBe(true)
    expect(patternMatches(".ts", "src/a.tsx")).toBe(false)
  })
  it("matches a dotless pattern against the whole basename", () => {
    expect(patternMatches("Dockerfile", "docker/Dockerfile")).toBe(true)
    expect(patternMatches("dockerfile", "docker/Dockerfile")).toBe(true)
    expect(patternMatches("Dockerfile", "docker/Dockerfile.dev")).toBe(false)
  })
  it("ignores a blank pattern", () => {
    expect(patternMatches("", "a.ts")).toBe(false)
    expect(patternMatches("   ", "a.ts")).toBe(false)
  })
})

describe("selectProvider", () => {
  const typescript = { id: "typescript", patterns: [".ts", ".tsx"] }
  const rust = { id: "lsp:rust-analyzer", patterns: [".rs"] }
  const override = { id: "lsp:vtsls", patterns: [".ts"] }

  it("picks the provider claiming the extension", () => {
    expect(selectProvider([typescript, rust], "src/a.tsx")?.id).toBe(
      "typescript"
    )
    expect(selectProvider([typescript, rust], "src/main.rs")?.id).toBe(
      "lsp:rust-analyzer"
    )
  })
  it("returns null when nothing claims the file", () => {
    expect(selectProvider([typescript, rust], "README.md")).toBeNull()
  })
  it("returns null for a blank path", () => {
    expect(selectProvider([typescript], "  ")).toBeNull()
  })
  it("lets an earlier provider shadow a later one", () => {
    expect(selectProvider([override, typescript], "src/a.ts")?.id).toBe(
      "lsp:vtsls"
    )
    expect(selectProvider([override, typescript], "src/a.tsx")?.id).toBe(
      "typescript"
    )
  })
  it("returns null when no providers are installed", () => {
    expect(selectProvider([], "src/a.ts")).toBeNull()
  })
})

describe("parsePositionQuery", () => {
  it("parses non-negative integers", () => {
    expect(parsePositionQuery({ line: "0", character: "12" })).toEqual({
      line: 0,
      character: 12,
    })
    expect(parsePositionQuery({ line: " 3 ", character: "4" })).toEqual({
      line: 3,
      character: 4,
    })
  })
  it("rejects anything that is not a whole number", () => {
    expect(parsePositionQuery({ line: "-1", character: "0" })).toBeNull()
    expect(parsePositionQuery({ line: "1.5", character: "0" })).toBeNull()
    expect(parsePositionQuery({ line: "", character: "0" })).toBeNull()
    expect(parsePositionQuery({ line: "abc", character: "0" })).toBeNull()
    expect(parsePositionQuery({ line: "1", character: "1e3" })).toBeNull()
  })
  it("rejects a value beyond safe-integer range", () => {
    expect(
      parsePositionQuery({ line: "99999999999999999999", character: "0" })
    ).toBeNull()
  })
})
