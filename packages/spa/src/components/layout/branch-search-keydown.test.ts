// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import {
  focusEdgeMenuRow,
  handleBranchSearchKeyDown,
  topLevelMenuRows,
} from "./branch-search-keydown"

function menuFixture() {
  const root = document.createElement("div")
  root.innerHTML = `
    <div data-slot="dropdown-menu-content">
      <div data-slot="dropdown-menu-sub-trigger">Actions</div>
      <div data-slot="dropdown-menu-item">main</div>
      <div data-slot="dropdown-menu-item" data-disabled="">ignored</div>
      <div data-slot="dropdown-menu-sub-content">
        <div data-slot="dropdown-menu-item">nested-only</div>
      </div>
      <div data-slot="dropdown-menu-item">feature</div>
    </div>
  `
  document.body.appendChild(root)
  const menu = root.querySelector<HTMLElement>(
    '[data-slot="dropdown-menu-content"]'
  )!
  return { root, menu }
}

describe("topLevelMenuRows", () => {
  it("returns enabled rows in this popup, not nested submenu items", () => {
    const { root, menu } = menuFixture()
    expect(topLevelMenuRows(menu).map((el) => el.textContent)).toEqual([
      "Actions",
      "main",
      "feature",
    ])
    root.remove()
  })
})

describe("focusEdgeMenuRow", () => {
  it("focuses the first or last top-level row", () => {
    const { root, menu } = menuFixture()
    const rows = topLevelMenuRows(menu)
    for (const row of rows) row.tabIndex = 0

    focusEdgeMenuRow(menu, "first")
    expect(document.activeElement).toBe(rows[0])

    focusEdgeMenuRow(menu, "last")
    expect(document.activeElement).toBe(rows[rows.length - 1])

    root.remove()
  })
})

describe("handleBranchSearchKeyDown", () => {
  function event(key: string, currentTarget: HTMLElement) {
    return {
      key,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      currentTarget,
    }
  }

  it("lets Escape through without stopping propagation", () => {
    const input = document.createElement("input")
    const e = event("Escape", input)
    handleBranchSearchKeyDown(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(e.stopPropagation).not.toHaveBeenCalled()
  })

  it("stops propagation for typing keys so the menu typeahead stays quiet", () => {
    const input = document.createElement("input")
    const e = event("m", input)
    handleBranchSearchKeyDown(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(e.stopPropagation).toHaveBeenCalledOnce()
  })

  it("moves focus to the first menu row on ArrowDown", () => {
    const { root, menu } = menuFixture()
    const rows = topLevelMenuRows(menu)
    for (const row of rows) row.tabIndex = 0

    const input = document.createElement("input")
    menu.prepend(input)
    const e = event("ArrowDown", input)
    handleBranchSearchKeyDown(e)

    expect(e.preventDefault).toHaveBeenCalledOnce()
    expect(e.stopPropagation).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(rows[0])
    root.remove()
  })

  it("moves focus to the last menu row on ArrowUp", () => {
    const { root, menu } = menuFixture()
    const rows = topLevelMenuRows(menu)
    for (const row of rows) row.tabIndex = 0

    const input = document.createElement("input")
    menu.prepend(input)
    const e = event("ArrowUp", input)
    handleBranchSearchKeyDown(e)

    expect(e.preventDefault).toHaveBeenCalledOnce()
    expect(e.stopPropagation).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(rows[rows.length - 1])
    root.remove()
  })
})
