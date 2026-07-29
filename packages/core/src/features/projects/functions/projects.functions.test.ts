import { describe, expect, it } from "vitest"
import {
  normalizeProjectKey,
  sortProjects,
  suggestProjectKey,
  uniqueProjectKey,
} from "./projects.functions.ts"
import type { Project } from "../schema/projects.schema.ts"

const project = (over: Partial<Project>): Project => ({
  id: "p1",
  key: "BYC",
  name: "Byconvo",
  description: "",
  color: "blue",
  archived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
})

describe("normalizeProjectKey", () => {
  it("keeps only alphanumerics, uppercased and capped", () => {
    expect(normalizeProjectKey(" by-convo! ")).toBe("BYCONV")
    expect(normalizeProjectKey("a1")).toBe("A1")
  })

  it("returns an empty string when nothing usable survives", () => {
    expect(normalizeProjectKey("---")).toBe("")
  })
})

describe("suggestProjectKey", () => {
  it("uses initials for multi-word names", () => {
    expect(suggestProjectKey("Hans Natur")).toBe("HN")
    expect(suggestProjectKey("darna digital organization")).toBe("DDO")
  })

  it("truncates a single word", () => {
    expect(suggestProjectKey("Byconvo")).toBe("BYC")
  })

  it("falls back for a name with no letters", () => {
    expect(suggestProjectKey("   ")).toBe("PRJ")
    expect(suggestProjectKey("!!!")).toBe("PRJ")
  })
})

describe("uniqueProjectKey", () => {
  it("passes an unused key through", () => {
    expect(uniqueProjectKey("BYC", ["ABC"])).toBe("BYC")
  })

  it("appends a counter until the key is free, case-insensitively", () => {
    expect(uniqueProjectKey("BYC", ["byc"])).toBe("BYC2")
    expect(uniqueProjectKey("BYC", ["BYC", "BYC2", "BYC3"])).toBe("BYC4")
  })

  it("keeps the suffixed key within the six-character cap", () => {
    expect(uniqueProjectKey("ABCDEF", ["ABCDEF"])).toBe("ABCDE2")
  })
})

describe("sortProjects", () => {
  it("puts live projects before archived ones, alphabetically within each", () => {
    const sorted = sortProjects([
      project({ id: "c", name: "Zulu" }),
      project({ id: "a", name: "Alpha", archived: true }),
      project({ id: "b", name: "Bravo" }),
    ])
    expect(sorted.map((p) => p.id)).toEqual(["b", "c", "a"])
  })
})
