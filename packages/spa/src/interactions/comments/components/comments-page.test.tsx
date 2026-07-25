// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReviewComment } from "@byconvo/core/comments"
import type { VisualComment } from "@byconvo/core/visual-comments"

const codeComment: ReviewComment = {
  id: "c-1",
  filePath: "packages/spa/src/lib/date-filter.ts",
  side: "additions",
  lineNumber: 18,
  body: "Add a 90-day window too",
  author: "you",
  createdAt: "2026-07-24T10:00:00.000Z",
  target: "worktree",
  source: "local",
}

const visualComment: VisualComment = {
  id: "v-1",
  body: "This save button should be primary",
  author: "you",
  createdAt: "2026-07-25T10:00:00.000Z",
  pageUrl: "http://localhost:41812/chats",
  pageTitle: "byconvo",
  route: "/chats",
  selector: "main > button#save",
  label: '<ChatsPage> button#save.btn "Save changes"',
  tagName: "button",
  elementText: "Save changes",
  elementHtml: '<button id="save" class="btn">Save changes</button>',
  rect: { x: 10, y: 20, width: 80, height: 32 },
  viewport: { width: 1440, height: 900 },
  sourceFile: "packages/spa/src/interactions/chats/components/chats-page.tsx",
  sourceLine: 371,
}

const removeVisual = vi.fn(() => Promise.resolve())
const removeCode = vi.fn(() => Promise.resolve(true))

vi.mock("@/lib/queries", () => ({
  useComments: () => ({ data: [codeComment] }),
  useVisualComments: () => ({ data: [visualComment] }),
}))
vi.mock("@/interactions/comments/adapters/comments.hook.adapter", () => ({
  useCommentsActions: () => ({ remove: removeCode }),
}))
vi.mock(
  "@/interactions/comments/adapters/visual-comments.hook.adapter",
  () => ({ useVisualCommentsActions: () => ({ remove: removeVisual }) })
)

// jsdom has no matchMedia, and `ui-prefs` reads the system theme on import.
vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
}))

const { CommentsPage } = await import("./comments-page")

const sidebar = () => screen.getByRole("complementary")

/** The pane beside the list; the anchor text also appears in the row itself. */
const detail = () => {
  const section = document.querySelector("section")
  if (section === null) throw new Error("detail pane missing")
  return within(section)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// Auto-cleanup is off without vitest `globals`, so renders would otherwise stack.
afterEach(cleanup)

describe("CommentsPage", () => {
  it("lists both kinds under their own group headers", () => {
    render(<CommentsPage />)

    expect(within(sidebar()).getByText("Visual")).toBeDefined()
    expect(within(sidebar()).getByText("Code")).toBeDefined()
    expect(screen.getByText("This save button should be primary")).toBeDefined()
    expect(screen.getByText("Add a 90-day window too")).toBeDefined()
  })

  it("prompts for a selection before anything is chosen", () => {
    render(<CommentsPage />)

    expect(screen.getByText(/select a comment/i)).toBeDefined()
  })

  it("shows a visual comment's element, selector and source on selection", async () => {
    const user = userEvent.setup()
    render(<CommentsPage />)

    await user.click(screen.getByText("This save button should be primary"))

    expect(screen.getByText(visualComment.selector)).toBeDefined()
    expect(screen.getByText(/chats-page\.tsx:371/)).toBeDefined()
    expect(screen.getByText(visualComment.elementHtml)).toBeDefined()
    expect(screen.getByText(visualComment.pageUrl)).toBeDefined()
  })

  it("shows a code comment's file and line on selection", async () => {
    const user = userEvent.setup()
    render(<CommentsPage />)

    await user.click(screen.getByText("Add a 90-day window too"))

    expect(
      detail().getByText("packages/spa/src/lib/date-filter.ts:18", {
        selector: "code",
      })
    ).toBeDefined()
  })

  it("filters the list down by a free-text search", async () => {
    const user = userEvent.setup()
    render(<CommentsPage />)

    await user.type(screen.getByLabelText("Search comments"), "90-day")

    expect(screen.queryByText("This save button should be primary")).toBeNull()
    expect(screen.getByText("Add a 90-day window too")).toBeDefined()
  })

  it("offers a way out when a search matches nothing", async () => {
    const user = userEvent.setup()
    render(<CommentsPage />)

    await user.type(screen.getByLabelText("Search comments"), "zzzzz")
    expect(screen.getByText(/no comments match/i)).toBeDefined()

    await user.click(screen.getByRole("button", { name: "Clear filters" }))
    expect(screen.getByText("Add a 90-day window too")).toBeDefined()
  })

  it("routes resolve to the right store for each kind", async () => {
    const user = userEvent.setup()
    render(<CommentsPage />)

    await user.click(screen.getByText("This save button should be primary"))
    await user.click(screen.getByRole("button", { name: "Resolve" }))
    expect(removeVisual).toHaveBeenCalledWith("v-1")
    expect(removeCode).not.toHaveBeenCalled()

    await user.click(screen.getByText("Add a 90-day window too"))
    await user.click(screen.getByRole("button", { name: "Resolve" }))
    expect(removeCode).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c-1" })
    )
  })
})
