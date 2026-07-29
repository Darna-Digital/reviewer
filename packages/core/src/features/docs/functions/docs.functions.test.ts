import { describe, expect, it } from "vitest"
import {
  resolveDocTitle,
  searchDocs,
  seedDocContent,
  sortDocs,
  titleFromContent,
  toDocSummary,
} from "./docs.functions.ts"
import type { Doc, DocSummary } from "../schema/docs.schema.ts"

const summary = (over: Partial<DocSummary> & { id: string }): DocSummary => ({
  projectId: "p1",
  title: "Plan",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
})

describe("titleFromContent", () => {
  it("uses the first markdown heading, at any level", () => {
    expect(titleFromContent("# Migration plan\n\nbody")).toBe("Migration plan")
    expect(titleFromContent("### Deep\n")).toBe("Deep")
  })

  it("skips blank lines before the heading", () => {
    expect(titleFromContent("\n\n  # Spaced  \n")).toBe("Spaced")
  })

  it("falls back to the first non-empty line", () => {
    expect(titleFromContent("just prose\nmore")).toBe("just prose")
  })

  it("falls back to Untitled for an empty document", () => {
    expect(titleFromContent("")).toBe("Untitled")
    expect(titleFromContent("\n  \n")).toBe("Untitled")
  })

  it("does not treat a bare hash as a heading", () => {
    expect(titleFromContent("#\nreal line")).toBe("#")
  })

  it("truncates a very long line", () => {
    expect(titleFromContent("x".repeat(400))).toHaveLength(120)
  })
})

describe("resolveDocTitle", () => {
  it("prefers an explicit title", () => {
    expect(resolveDocTitle("  Roadmap  ", "# Other")).toBe("Roadmap")
  })

  it("falls back to the content when the title is blank", () => {
    expect(resolveDocTitle("   ", "# Other")).toBe("Other")
    expect(resolveDocTitle(undefined, "# Other")).toBe("Other")
  })
})

describe("seedDocContent", () => {
  it("opens a new doc with its title as an H1", () => {
    expect(seedDocContent("Plan")).toBe("# Plan\n\n")
  })
})

describe("sortDocs", () => {
  it("puts the most recently updated first", () => {
    const sorted = sortDocs([
      summary({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
      summary({ id: "new", updatedAt: "2026-02-01T00:00:00.000Z" }),
    ])
    expect(sorted.map((d) => d.id)).toEqual(["new", "old"])
  })

  it("breaks ties on title", () => {
    const sorted = sortDocs([
      summary({ id: "b", title: "Beta" }),
      summary({ id: "a", title: "Alpha" }),
    ])
    expect(sorted.map((d) => d.id)).toEqual(["a", "b"])
  })
})

describe("toDocSummary", () => {
  it("drops the body", () => {
    const doc: Doc = {
      id: "d1",
      projectId: "p1",
      title: "Plan",
      content: "# Plan",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }
    expect(toDocSummary(doc)).toEqual({
      id: "d1",
      projectId: "p1",
      title: "Plan",
      updatedAt: "2026-01-01T00:00:00.000Z",
    })
  })
})

describe("searchDocs", () => {
  const docs = [summary({ id: "a", title: "Migration plan" }), summary({ id: "b", title: "Roadmap" })]

  it("returns everything for a blank query", () => {
    expect(searchDocs(docs, "  ")).toHaveLength(2)
  })

  it("matches titles case-insensitively", () => {
    expect(searchDocs(docs, "MIGRA").map((d) => d.id)).toEqual(["a"])
  })
})
