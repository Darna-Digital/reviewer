// @vitest-environment jsdom
/**
 * A menu row can carry a tooltip of its own — the window menu says its chords
 * that way — and it sits inside the tooltip every row already has for text the
 * menu cuts off. The two must not stand on each other: the row stays a menu
 * item you can pick, and its own tooltip is the one that opens.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ROW_TOOLTIP_PLACEMENT } from "@/components/ui/truncated-text";

afterEach(cleanup);

const openMenu = (onClick: () => void) =>
  render(
    <TooltipProvider>
      <DropdownMenu open>
        <DropdownMenuTrigger>Window menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <Tooltip>
            <TooltipTrigger render={<DropdownMenuItem onClick={onClick} />}>
              Analysis
            </TooltipTrigger>
            <TooltipContent {...ROW_TOOLTIP_PLACEMENT}>
              Analysis
              <Kbd>A</Kbd>
            </TooltipContent>
          </Tooltip>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );

const tooltip = () => document.querySelector('[data-slot="tooltip-content"]');

describe("a menu row with a chord in its tooltip", () => {
  it("stays a menu item that picks", async () => {
    const onClick = vi.fn();
    openMenu(onClick);

    await userEvent.click(screen.getByRole("menuitem"));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("sets the chord in keycaps once the pointer is on the row", async () => {
    openMenu(vi.fn());

    await userEvent.hover(screen.getByRole("menuitem"));

    await waitFor(() => expect(tooltip()?.textContent).toBe("AnalysisA"));
    expect(tooltip()?.querySelector('[data-slot="kbd"]')).not.toBeNull();
  });

  it("says nothing until it is hovered", () => {
    openMenu(vi.fn());

    expect(tooltip()).toBeNull();
    expect(screen.getByRole("menuitem").textContent).toBe("Analysis");
  });
});
