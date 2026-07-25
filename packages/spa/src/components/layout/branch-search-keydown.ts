const MENU_CONTENT = '[data-slot="dropdown-menu-content"]'
const MENU_ROW =
  '[data-slot="dropdown-menu-sub-trigger"], [data-slot="dropdown-menu-item"]'
const MENU_SURFACE =
  '[data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-sub-content"]'

type SearchKeyEvent = {
  key: string
  preventDefault: () => void
  stopPropagation: () => void
  currentTarget: {
    closest: (selector: string) => Element | null
  }
}

/** Rows in this popup only — skips nested submenu items and disabled rows. */
export function topLevelMenuRows(menu: HTMLElement): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>(MENU_ROW)].filter((el) => {
    if (el.hasAttribute("data-disabled")) return false
    return el.closest(MENU_SURFACE) === menu
  })
}

export function focusEdgeMenuRow(
  menu: HTMLElement,
  edge: "first" | "last"
): void {
  const rows = topLevelMenuRows(menu)
  if (rows.length === 0) return
  const row = edge === "first" ? rows[0] : rows[rows.length - 1]
  row.focus()
}

/**
 * Keeps typing in the branch filter, and moves focus into the menu on arrows.
 * Escape is left alone so the menu can dismiss itself.
 */
export function handleBranchSearchKeyDown(event: SearchKeyEvent): void {
  if (event.key === "Escape") return

  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
    event.stopPropagation()
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const menu = event.currentTarget.closest(MENU_CONTENT)
  if (!(menu instanceof HTMLElement)) return

  focusEdgeMenuRow(menu, event.key === "ArrowDown" ? "first" : "last")
}
