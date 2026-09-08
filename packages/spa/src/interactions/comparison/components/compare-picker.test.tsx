// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { LocalComparison } from "@reviewer/core/comparison";
import { ComparePicker, CompareMenuItems } from "./compare-picker";

afterEach(cleanup);

const BRANCHES = ["main", "development", "feature/x"];
const REMOTES = ["origin/main", "origin/feature/x"];

/** The menu's body, open, with no pointer needed to get there. */
const openMenu = (
  comparison: LocalComparison,
  onSelect: (ref: string | null) => void
) =>
  render(
    <TooltipProvider>
      <DropdownMenu open>
        <DropdownMenuTrigger>Compare</DropdownMenuTrigger>
        <DropdownMenuContent>
          <CompareMenuItems
            comparison={comparison}
            branch="feature/x"
            aim="development"
            branches={BRANCHES}
            remoteBranches={REMOTES}
            onSelect={onSelect}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );

describe("ComparePicker", () => {
  it("says the branch is being read against itself-with-changes by default", () => {
    render(
      <ComparePicker
        comparison={{ kind: "uncommitted" }}
        branch="feature/x"
        aim={null}
        branches={BRANCHES}
        remoteBranches={REMOTES}
        onSelect={() => {}}
      />
    );

    const trigger = screen.getByRole("button", {
      name: "Comparing ‘feature/x’ against ‘feature/x with changes’",
    });
    // The branch is named once on the chip, not twice — the whole sentence is
    // in the label the tooltip and a screen reader read.
    expect(trigger.textContent).toBe("feature/xwith changes");
  });

  it("names the compared branch on the left once one is chosen", () => {
    render(
      <ComparePicker
        comparison={{ kind: "branch", against: "main" }}
        branch="feature/x"
        aim={null}
        branches={BRANCHES}
        remoteBranches={REMOTES}
        onSelect={() => {}}
      />
    );

    const trigger = screen.getByRole("button", {
      name: "Comparing ‘main’ against ‘feature/x with changes’",
    });
    // Two different branches, so both are named on the chip.
    expect(trigger.textContent).toBe("mainfeature/x with changes");
  });
});

describe("CompareMenuItems", () => {
  it("offers every other branch, local and remote", () => {
    openMenu({ kind: "uncommitted" }, () => {});

    expect(screen.getByText("main")).toBeTruthy();
    expect(screen.getByText("development")).toBeTruthy();
    expect(screen.getByText("origin/main")).toBeTruthy();
    // Diffing the checked-out branch with itself says nothing the
    // "uncommitted changes" row does not already say.
    expect(screen.queryByText("feature/x")).toBeNull();
    // Its remote counterpart is a real question: what have I not pushed yet.
    expect(screen.getByText("origin/feature/x")).toBeTruthy();
  });

  it("marks where the branch's work is aimed", () => {
    openMenu({ kind: "uncommitted" }, () => {});

    expect(screen.getByText("lands here")).toBeTruthy();
  });

  it("reads a branch against the changes when one is picked", async () => {
    const onSelect = vi.fn();
    openMenu({ kind: "uncommitted" }, onSelect);

    await userEvent.click(screen.getByText("main"));

    expect(onSelect).toHaveBeenCalledWith("main");
  });

  it("drops back to uncommitted changes with null, not with a branch name", async () => {
    const onSelect = vi.fn();
    openMenu({ kind: "branch", against: "main" }, onSelect);

    await userEvent.click(screen.getByText("Uncommitted changes"));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("narrows both lists as you search, and says when nothing is left", async () => {
    openMenu({ kind: "uncommitted" }, () => {});

    await userEvent.type(
      screen.getByLabelText("Search branches"),
      "development"
    );
    expect(screen.getByText("development")).toBeTruthy();
    expect(screen.queryByText("main")).toBeNull();

    await userEvent.clear(screen.getByLabelText("Search branches"));
    await userEvent.type(screen.getByLabelText("Search branches"), "zzz");
    expect(screen.getByText("No branch matches.")).toBeTruthy();
  });
});
