// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TooltipProvider } from "@/components/ui/tooltip"

afterEach(cleanup)

const LONG = "task/BMB-207-a-branch-name-far-wider-than-the-menu"

/** jsdom does no layout, so the label's overflow is declared rather than measured. */
const clipLabel = () => {
  const label = document.querySelector(".label")
  if (label === null) throw new Error("no label rendered")
  Object.defineProperty(label, "scrollWidth", { value: 400 })
  Object.defineProperty(label, "clientWidth", { value: 160 })
}

const openMenu = (label: string) =>
  render(
    <TooltipProvider>
      <DropdownMenu open>
        <DropdownMenuTrigger>Branch</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            <span className="label truncate">{label}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  )

describe("dropdown item truncation", () => {
  it("keeps the item a menu item, not a bare tooltip trigger", () => {
    openMenu(LONG)

    const item = document.querySelector('[data-slot="dropdown-menu-item"]')
    expect(item).not.toBeNull()
    expect(item?.getAttribute("role")).toBe("menuitem")
  })

  it("reveals the full label on hover once it is clipped", async () => {
    openMenu(LONG)
    clipLabel()

    await userEvent.hover(screen.getByRole("menuitem"))

    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="tooltip-content"]')?.textContent
      ).toBe(LONG)
    )
  })

  it("stays quiet on a label that fits", async () => {
    openMenu("main")

    await userEvent.hover(screen.getByRole("menuitem"))

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull()
  })
})
