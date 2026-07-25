import { describe, expect, it } from "vitest"
import type { ReviewComment } from "@byconvo/core/comments"
import type { VisualComment } from "@byconvo/core/visual-comments"
import {
  applyFilters,
  buildAssignmentPrompt,
  groupByKind,
  noFilters,
  unify,
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

const visual = (over: Partial<VisualComment> = {}): VisualComment => ({
  id: "v-1",
  body: "make this primary",
  author: "you",
  createdAt: "2026-07-02T00:00:00.000Z",
  pageUrl: "http://localhost:3000/settings",
  pageTitle: "Settings",
  route: "/settings",
  selector: "#save",
  label: 'button#save "Save"',
  tagName: "button",
  elementText: "Save",
  elementHtml: "<button id='save'>Save</button>",
  rect: { x: 0, y: 0, width: 10, height: 10 },
  viewport: { width: 800, height: 600 },
  ...over,
})

describe("unify", () => {
  it("orders newest first so the freshest observation is worked on first", () => {
    const list = unify([code()], [visual()])

    expect(list.map((c) => c.id)).toEqual(["v-1", "c-1"])
  })

  it("anchors a code comment to file:line and a visual one to its element", () => {
    const [visualComment, codeComment] = unify([code()], [visual()])

    expect(codeComment?.anchor).toBe("src/app.ts:42")
    expect(visualComment?.anchor).toBe('button#save "Save"')
    expect(visualComment?.context).toBe("/settings")
  })

  it("drops GitHub PR comments — only local ones are the reviewer's to act on", () => {
    const list = unify([code({ source: "github" })], [])

    expect(list).toEqual([])
  })
})

describe("applyFilters", () => {
  const all = unify([code()], [visual()])

  it("keeps everything when no filter is set", () => {
    expect(applyFilters(all, noFilters)).toHaveLength(2)
  })

  it("narrows to one kind", () => {
    const visualOnly = applyFilters(all, { ...noFilters, kind: "visual" })

    expect(visualOnly.map((c) => c.id)).toEqual(["v-1"])
  })

  it("searches the anchor and context, not just the body", () => {
    expect(
      applyFilters(all, { ...noFilters, search: "app.ts" }).map((c) => c.id)
    ).toEqual(["c-1"])
    expect(
      applyFilters(all, { ...noFilters, search: "/settings" }).map((c) => c.id)
    ).toEqual(["v-1"])
  })

  it("ignores case and surrounding whitespace in the query", () => {
    expect(
      applyFilters(all, { ...noFilters, search: "  PRIMARY " }).map((c) => c.id)
    ).toEqual(["v-1"])
  })

  it("hides comments older than the selected window", () => {
    const old = unify([code({ createdAt: "2020-01-01T00:00:00.000Z" })], [])

    expect(applyFilters(old, { ...noFilters, date: "today" })).toEqual([])
  })
})

describe("buildAssignmentPrompt", () => {
  it("keeps the file:line form an agent already knows for code comments", () => {
    const prompt = buildAssignmentPrompt(unify([code()], []))

    expect(prompt).toContain("src/app.ts:42 - extract a helper")
  })

  it("gives a visual comment the context needed to find its source", () => {
    const prompt = buildAssignmentPrompt(unify([], [visual()]))

    expect(prompt).toContain(
      '/settings — button#save "Save" - make this primary'
    )
    expect(prompt).toContain("selector: #save")
    expect(prompt).toContain("page: http://localhost:3000/settings")
  })

  it("includes the source file when the picker captured one", () => {
    const withSource = visual({
      sourceFile: "src/settings-form.tsx",
      sourceLine: 42,
    })

    expect(buildAssignmentPrompt(unify([], [withSource]))).toContain(
      "source: src/settings-form.tsx:42"
    )
  })

  it("omits the source line when only a file was captured", () => {
    const fileOnly = visual({ sourceFile: "src/settings-form.tsx" })

    expect(buildAssignmentPrompt(unify([], [fileOnly]))).toContain(
      "source: src/settings-form.tsx\n"
    )
  })

  it("carries both kinds in one prompt", () => {
    const prompt = buildAssignmentPrompt(unify([code()], [visual()]))

    expect(prompt).toContain("extract a helper")
    expect(prompt).toContain("make this primary")
  })
})

describe("groupByKind", () => {
  it("omits a kind that has no comments rather than showing an empty group", () => {
    const groups = groupByKind(unify([code()], []))

    expect(groups.map((g) => g.kind)).toEqual(["code"])
  })
})
