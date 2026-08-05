// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";

afterEach(cleanup);

const LONG = "task/BMB-207-a-branch-name-far-wider-than-the-menu";

/** Long enough to clear the submenu's hover delay and the tooltip's wait behind it. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

/** jsdom does no layout, so the label's overflow is declared rather than measured. */
const clipLabel = () => {
  const label = document.querySelector(".label");
  if (label === null) throw new Error("no label rendered");
  Object.defineProperty(label, "scrollWidth", { value: 400 });
  Object.defineProperty(label, "clientWidth", { value: 160 });
};

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
  );

const openMenuWithSubmenu = (label: string, submenuOpen: boolean) =>
  render(
    <TooltipProvider>
      <DropdownMenu open>
        <DropdownMenuTrigger>Branch</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub open={submenuOpen}>
            <DropdownMenuSubTrigger>
              <span className="label truncate">{label}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Checkout</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );

const tooltip = () => document.querySelector('[data-slot="tooltip-content"]');

describe("dropdown item truncation", () => {
  it("keeps the item a menu item, not a bare tooltip trigger", () => {
    openMenu(LONG);

    const item = document.querySelector('[data-slot="dropdown-menu-item"]');
    expect(item).not.toBeNull();
    expect(item?.getAttribute("role")).toBe("menuitem");
  });

  it("reveals the full label on hover once it is clipped", async () => {
    openMenu(LONG);
    clipLabel();

    await userEvent.hover(screen.getByRole("menuitem"));

    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="tooltip-content"]')?.textContent
      ).toBe(LONG)
    );
  });

  it("stays quiet on a label that fits", async () => {
    openMenu("main");

    await userEvent.hover(screen.getByRole("menuitem"));

    await settle();
    expect(tooltip()).toBeNull();
  });

  it("refuses to cover a submenu that is already open", async () => {
    openMenuWithSubmenu(LONG, true);
    clipLabel();

    await userEvent.hover(screen.getByRole("menuitem", { expanded: true }));

    await settle();
    expect(tooltip()).toBeNull();
  });

  it("still explains a clipped row whose submenu is shut", async () => {
    openMenuWithSubmenu(LONG, false);
    clipLabel();

    await userEvent.hover(screen.getByRole("menuitem"));

    await waitFor(() => expect(tooltip()?.textContent).toBe(LONG));
  });

  it("steps aside when the submenu opens underneath it", async () => {
    const { rerender } = openMenuWithSubmenu(LONG, false);
    clipLabel();
    await userEvent.hover(screen.getByRole("menuitem"));
    await waitFor(() => expect(tooltip()).not.toBeNull());

    rerender(
      <TooltipProvider>
        <DropdownMenu open>
          <DropdownMenuTrigger>Branch</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub open>
              <DropdownMenuSubTrigger>
                <span className="label truncate">{LONG}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Checkout</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
    );

    await waitFor(() => expect(tooltip()).toBeNull());
  });
});
