// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

afterEach(cleanup)

const surfaceOf = (slot: string) =>
  document
    .querySelector(`[data-slot="${slot}"]`)
    ?.getAttribute("data-surface") ?? null

describe("surface elevation", () => {
  it("lifts a submenu above the menu it opened from", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Branch</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub open>
            <DropdownMenuSubTrigger>main</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Checkout</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    expect(surfaceOf("dropdown-menu-content")).toBe("3")
    expect(surfaceOf("dropdown-menu-sub-content")).toBe("5")
    expect(
      document.querySelector('[data-slot="dropdown-menu-sub-content"]')
        ?.className
    ).toContain("bg-surface-5")
  })

  it("lifts a menu opened inside a dialog above the dialog", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DropdownMenu open>
            <DropdownMenuTrigger>Start point</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>main</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DialogContent>
      </Dialog>
    )

    expect(surfaceOf("dialog-content")).toBe("5")
    expect(surfaceOf("dropdown-menu-content")).toBe("7")
  })

  it("clamps at the top of the ladder", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DropdownMenu open>
            <DropdownMenuTrigger>Start point</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuSub open>
                <DropdownMenuSubTrigger>task</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>Checkout</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </DialogContent>
      </Dialog>
    )

    expect(surfaceOf("dropdown-menu-sub-content")).toBe("8")
    expect(screen.getByText("Checkout")).toBeDefined()
  })
})
