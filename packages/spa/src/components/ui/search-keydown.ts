/**
 * Keyboard wiring shared by the search-topped popups (the branch switcher's
 * menu and the project picker's popover): typing stays in the filter box, and
 * the arrow keys walk the rows below it.
 *
 * Rows are menu items in a `DropdownMenu`, or anything tagged `data-search-row`
 * in a plain popover; the filter box is tagged `data-search-input`.
 */
const PANEL =
  '[data-slot="dropdown-menu-content"], [data-slot="popover-content"]'
const NESTED_PANEL = `${PANEL}, [data-slot="dropdown-menu-sub-content"]`
const ROW =
  '[data-slot="dropdown-menu-sub-trigger"], [data-slot="dropdown-menu-item"], [data-search-row]'
const SEARCH_INPUT = "[data-search-input]"

type SearchKeyEvent = {
  key: string
  preventDefault: () => void
  stopPropagation: () => void
  currentTarget: {
    closest: (selector: string) => Element | null
  }
}

type RowKeyEvent = SearchKeyEvent & { target: EventTarget | null }

/** Rows in this popup only — skips nested submenu items and disabled rows. */
export function topLevelMenuRows(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(ROW)].filter((el) => {
    if (el.hasAttribute("data-disabled")) return false
    return el.closest(NESTED_PANEL) === panel
  })
}

export function focusEdgeMenuRow(
  panel: HTMLElement,
  edge: "first" | "last"
): void {
  const rows = topLevelMenuRows(panel)
  if (rows.length === 0) return
  const row = edge === "first" ? rows[0] : rows[rows.length - 1]
  row.focus()
}

/**
 * Keeps typing in the filter box, and moves focus into the list on arrows.
 * Escape is left alone so the popup can dismiss itself.
 */
export function handleSearchKeyDown(event: SearchKeyEvent): void {
  if (event.key === "Escape") return

  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
    event.stopPropagation()
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const panel = event.currentTarget.closest(PANEL)
  if (!(panel instanceof HTMLElement)) return

  focusEdgeMenuRow(panel, event.key === "ArrowDown" ? "first" : "last")
}

/**
 * Roving focus for popover rows, which — unlike menu items — get no navigation
 * from the primitive. Wraps at the ends, and arrowing up off the top row hands
 * focus back to the filter box.
 */
export function handleSearchRowKeyDown(event: RowKeyEvent): void {
  const { key } = event
  if (
    key !== "ArrowDown" &&
    key !== "ArrowUp" &&
    key !== "Home" &&
    key !== "End"
  )
    return

  const target = event.target instanceof Element ? event.target : null
  const row = target?.closest(ROW)
  const panel = row?.closest(NESTED_PANEL)
  if (!(row instanceof HTMLElement) || !(panel instanceof HTMLElement)) return

  const rows = topLevelMenuRows(panel)
  const at = rows.indexOf(row)
  if (at < 0) return

  event.preventDefault()
  event.stopPropagation()

  if (key === "Home") return rows[0].focus()
  if (key === "End") return rows[rows.length - 1].focus()
  if (key === "ArrowDown") return rows[(at + 1) % rows.length].focus()

  const search = panel.querySelector<HTMLElement>(SEARCH_INPUT)
  if (at === 0 && search !== null) return search.focus()
  rows[(at - 1 + rows.length) % rows.length].focus()
}
