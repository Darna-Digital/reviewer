import { describe, expect, it } from "vitest"
import {
  buildCommentTree,
  countBySubject,
  countReplies,
  normalizeCommentBody,
  sortComments,
} from "./workspace-comments.functions.ts"
import type { WorkspaceComment } from "../schema/workspace-comments.schema.ts"

const comment = (
  over: Partial<WorkspaceComment> & { id: string }
): WorkspaceComment => ({
  subjectType: "task",
  subjectId: "t1",
  parentId: null,
  body: "a comment",
  author: {
    id: "u1",
    name: "Rūtenis",
    email: "r@example.com",
    image: null,
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  edited: false,
  ...over,
})

describe("sortComments", () => {
  it("orders oldest first and breaks ties on id", () => {
    const sorted = sortComments([
      comment({ id: "b", createdAt: "2026-01-02T00:00:00.000Z" }),
      comment({ id: "a", createdAt: "2026-01-01T00:00:00.000Z" }),
      comment({ id: "c", createdAt: "2026-01-01T00:00:00.000Z" }),
    ])
    expect(sorted.map((c) => c.id)).toEqual(["a", "c", "b"])
  })
})

describe("buildCommentTree", () => {
  it("nests replies under their parent, oldest first", () => {
    const tree = buildCommentTree([
      comment({ id: "root" }),
      comment({
        id: "later",
        parentId: "root",
        createdAt: "2026-01-03T00:00:00.000Z",
      }),
      comment({
        id: "earlier",
        parentId: "root",
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.replies.map((r) => r.comment.id)).toEqual([
      "earlier",
      "later",
    ])
  })

  it("nests arbitrarily deep", () => {
    const tree = buildCommentTree([
      comment({ id: "a" }),
      comment({ id: "b", parentId: "a" }),
      comment({ id: "c", parentId: "b" }),
    ])
    expect(tree[0]!.replies[0]!.replies[0]!.comment.id).toBe("c")
  })

  it("promotes a reply whose parent is missing", () => {
    const tree = buildCommentTree([comment({ id: "orphan", parentId: "gone" })])
    expect(tree.map((n) => n.comment.id)).toEqual(["orphan"])
  })
})

describe("countReplies", () => {
  it("counts every descendant, not just direct replies", () => {
    const tree = buildCommentTree([
      comment({ id: "a" }),
      comment({ id: "b", parentId: "a" }),
      comment({ id: "c", parentId: "b" }),
    ])
    expect(countReplies(tree[0]!)).toBe(2)
  })

  it("is zero for a leaf", () => {
    const tree = buildCommentTree([comment({ id: "a" })])
    expect(countReplies(tree[0]!)).toBe(0)
  })
})

describe("normalizeCommentBody", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeCommentBody("  hi  ")).toBe("hi")
  })
})

describe("countBySubject", () => {
  it("tallies comments per subject", () => {
    const counts = countBySubject([
      comment({ id: "1", subjectId: "t1" }),
      comment({ id: "2", subjectId: "t1" }),
      comment({ id: "3", subjectId: "t2" }),
    ])
    expect(counts.get("t1")).toBe(2)
    expect(counts.get("t2")).toBe(1)
    expect(counts.get("t3")).toBeUndefined()
  })
})
