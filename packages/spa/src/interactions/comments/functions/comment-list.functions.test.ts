import { describe, expect, it } from "vitest"
import type { ReviewComment } from "@byconvo/core/comments"
import {
  applyFilters,
  buildAssignmentPrompt,
  listComments,
  noFilters,
} from "./comment-list.functions"

const code = (over: Partial<ReviewComment> = {}): ReviewComment => ({
  id: "c-1",
  filePath: "src/app.ts",
  side: "additions",
  lineNumber: 42,
  body: "extract a helper",
  author: "you",
  createdAt: "2026-07-01T00:00:00.000Z",
  target: "worktree",
  source: "local",
  ...over,
})

describe("listComments", () => {
  it("orders newest first so the freshest observation is worked on first", () => {
    const list = listComments([
      code(),
      code({ id: "c-2", createdAt: "2026-07-02T00:00:00.000Z" }),
    ])

    expect(list.map((c) => c.id)).toEqual(["c-2", "c-1"])
  })

  it("anchors a comment to file:line", () => {
    const [comment] = listComments([code()])

    expect(comment?.anchor).toBe("src/app.ts:42")
    expect(comment?.context).toBe("worktree")
  })

  it("drops GitHub PR comments — only local ones are the reviewer's to act on", () => {
    expect(listComments([code({ source: "github" })])).toEqual([])
  })
})

describe("applyFilters", () => {
  const all = listComments([
    code(),
    code({
      id: "c-2",
      filePath: "src/settings.ts",
      body: "make this primary",
      createdAt: "2026-07-02T00:00:00.000Z",
    }),
  ])

  it("keeps everything when no filter is set", () => {
    expect(applyFilters(all, noFilters)).toHaveLength(2)
  })

  it("searches the anchor and context, not just the body", () => {
    expect(
      applyFilters(all, { ...noFilters, search: "app.ts" }).map((c) => c.id)
    ).toEqual(["c-1"])
  })

  it("ignores case and surrounding whitespace in the query", () => {
    expect(
      applyFilters(all, { ...noFilters, search: "  PRIMARY " }).map((c) => c.id)
    ).toEqual(["c-2"])
  })

  it("hides comments older than the selected window", () => {
    const old = listComments([code({ createdAt: "2020-01-01T00:00:00.000Z" })])

    expect(applyFilters(old, { ...noFilters, date: "today" })).toEqual([])
  })
})

describe("buildAssignmentPrompt", () => {
  it("keeps the file:line form an agent already knows", () => {
    const prompt = buildAssignmentPrompt(listComments([code()]))

    expect(prompt).toContain("src/app.ts:42 - extract a helper")
  })

  it("carries every comment in one prompt", () => {
    const prompt = buildAssignmentPrompt(
      listComments([code(), code({ id: "c-2", body: "make this primary" })])
    )

    expect(prompt).toContain("extract a helper")
    expect(prompt).toContain("make this primary")
  })
})
