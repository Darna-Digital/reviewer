// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReviewComment } from "@byconvo/core/comments"
import type * as RouterModule from "@tanstack/react-router"

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

const otherComment: ReviewComment = {
  id: "c-2",
  filePath: "packages/spa/src/interactions/chats/components/chats-page.tsx",
  side: "additions",
  lineNumber: 371,
  body: "This save button should be primary",
  author: "you",
  createdAt: "2026-07-25T10:00:00.000Z",
  target: "worktree",
  source: "local",
}

const removeCode = vi.fn(() => Promise.resolve(true))
const updateCode = vi.fn((_comment: ReviewComment, body: string) =>
  Promise.resolve({ ...codeComment, body })
)
const startWithTitle = vi.fn(
  (_settings: unknown, _branch: string, _title: string, _prompt: string) =>
    Promise.resolve({ id: "chat-1" })
)
const send = vi.fn((_chatId: string, _prompt: string) =>
  Promise.resolve({ id: "m-1" })
)
const navigate = vi.fn()

vi.mock("@/lib/queries", () => ({
  useComments: () => ({ data: [codeComment, otherComment] }),
  useChats: () => ({ data: [] }),
  useChatModels: () => ({ data: undefined }),
  useRepo: () => ({ data: { currentBranch: "main" } }),
}))
vi.mock("@/interactions/comments/adapters/comments.hook.adapter", () => ({
  useCommentsActions: () => ({ remove: removeCode, update: updateCode }),
}))
vi.mock("@/interactions/chats/adapters/chats.hook.adapter", () => ({
  useChatsActions: () => ({ startWithTitle, send }),
}))
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof RouterModule>()),
  useNavigate: () => navigate,
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown
  }) => select({ location: { pathname: "/modes/code/comments" } }),
  Link: ({
    children,
    ...props
  }: {
    children?: React.ReactNode
    to?: string
    className?: string
  }) => (
    <a href={props.to ?? "#"} className={props.className}>
      {children}
    </a>
  ),
}))

// jsdom has no matchMedia, and `ui-prefs` reads the system theme on import.
vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
}))

const { CommentsPage } = await import("./comments-page")

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
  it("lists every local comment", () => {
    render(<CommentsPage />)

    expect(screen.getByText("This save button should be primary")).toBeDefined()
    expect(screen.getByText("Add a 90-day window too")).toBeDefined()
  })

  it("prompts for a selection before anything is chosen", () => {
    render(<CommentsPage />)

    expect(screen.getByText(/select a comment/i)).toBeDefined()
  })

  it("shows a comment's file and line on selection", async () => {
    const user = userEvent.setup()
    render(<CommentsPage />)

    await user.click(screen.getByText("Add a 90-day window too"))

    expect(
      detail().getByText("packages/spa/src/lib/date-filter.ts:18", {
        selector: "code",
      })
    ).toBeDefined()
    expect(navigate).toHaveBeenCalledWith({
      to: "/modes/code/commit",
      search: { path: "packages/spa/src/lib/date-filter.ts" },
    })
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

  it("offers to assign the comments, counting them all", () => {
    render(<CommentsPage />)

    expect(screen.getByText("2")).toBeDefined()
    expect(screen.getByRole("button", { name: /assign to fix/i })).toBeDefined()
  })

  it("seeds a new chat with every comment and clears them once handed off", async () => {
    const user = userEvent.setup()
    render(<CommentsPage />)

    await user.click(screen.getByRole("button", { name: /assign to fix/i }))

    expect(startWithTitle).toHaveBeenCalledOnce()
    const prompt = startWithTitle.mock.calls[0][3]
    expect(prompt).toContain("date-filter.ts:18 - Add a 90-day window too")
    expect(prompt).toContain(
      "chats-page.tsx:371 - This save button should be primary"
    )

    expect(removeCode).toHaveBeenCalledTimes(2)
    expect(navigate).toHaveBeenCalledWith({
      to: "/modes/code/chats/$chatId",
      params: { chatId: "chat-1" },
    })
  })

  it("assigns only what the filter leaves visible", async () => {
    const user = userEvent.setup()
    render(<CommentsPage />)

    await user.type(screen.getByLabelText("Search comments"), "90-day")
    await user.click(screen.getByRole("button", { name: /assign to fix/i }))

    const prompt = startWithTitle.mock.calls[0][3]
    expect(prompt).toContain("Add a 90-day window too")
    expect(prompt).not.toContain("This save button should be primary")
    expect(removeCode).toHaveBeenCalledOnce()
  })

  it("can be dismissed", async () => {
    const user = userEvent.setup()
    render(<CommentsPage />)

    await user.click(screen.getByRole("button", { name: "Dismiss" }))

    expect(screen.queryByRole("button", { name: /assign to fix/i })).toBeNull()
  })

  it("resolves the selected comment", async () => {
    const user = userEvent.setup()
    render(<CommentsPage />)

    await user.click(screen.getByText("Add a 90-day window too"))
    await user.click(screen.getByRole("button", { name: "Resolve" }))

    expect(removeCode).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c-1" })
    )
  })

  it("resolves a comment straight from its list row", async () => {
    const user = userEvent.setup()
    render(<CommentsPage />)

    const [firstRowResolve] = screen.getAllByRole("button", {
      name: "Resolve comment",
    })
    await user.click(firstRowResolve)

    expect(removeCode).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c-2" })
    )
  })

  it("saves an edited comment body", async () => {
    const user = userEvent.setup()
    render(<CommentsPage />)

    await user.click(screen.getByText("Add a 90-day window too"))
    await user.click(screen.getByRole("button", { name: "Edit" }))
    const box = screen.getByPlaceholderText("Edit comment…")
    await user.clear(box)
    await user.type(box, "Add a 180-day window too")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(updateCode).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c-1" }),
      "Add a 180-day window too"
    )
  })
})
