// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { FindBar } from "./find-bar";
import { DEFAULT_FIND_OPTIONS } from "../functions/find-in-file.functions";
import type { FindOptions } from "../interfaces/find-in-file.interfaces";

afterEach(cleanup);

/** The bar with its query and modifiers held for it, as the hook holds them. */
function Harness({
  onStep = vi.fn(),
  onClose = vi.fn(),
}: {
  onStep?: (direction: "next" | "previous") => void;
  onClose?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<FindOptions>(DEFAULT_FIND_OPTIONS);
  return (
    <FindBar
      path="src/lib/queries.ts"
      query={query}
      onQueryChange={setQuery}
      options={options}
      onOptionsChange={setOptions}
      status={query === "" ? "" : "1 of 3"}
      hasMatches={query !== ""}
      onStep={onStep}
      onClose={onClose}
      focusKey={1}
    />
  );
}

describe("FindBar", () => {
  it("takes the caret as soon as it appears", () => {
    render(<Harness />);
    expect(screen.getByRole("textbox", { name: "Find in file" })).toBe(
      document.activeElement
    );
  });

  it("names the file it belongs to", () => {
    render(<Harness />);
    expect(
      screen.getByRole("search", { name: "Find in src/lib/queries.ts" })
    ).toBeTruthy();
  });

  it("counts only once there is something to count", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByText("1 of 3")).toBeNull();
    await user.type(
      screen.getByRole("textbox", { name: "Find in file" }),
      "value"
    );
    expect(screen.getByText("1 of 3")).toBeTruthy();
  });

  it("steps forwards on Enter and back on Shift+Enter", async () => {
    const user = userEvent.setup();
    const onStep = vi.fn();
    render(<Harness onStep={onStep} />);
    await user.type(
      screen.getByRole("textbox", { name: "Find in file" }),
      "value{Enter}"
    );
    expect(onStep).toHaveBeenLastCalledWith("next");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onStep).toHaveBeenLastCalledWith("previous");
  });

  it("steps from the buttons, which are dead until there is a match", async () => {
    const user = userEvent.setup();
    const onStep = vi.fn();
    render(<Harness onStep={onStep} />);
    expect(
      screen
        .getByRole("button", { name: "Next match" })
        .hasAttribute("disabled")
    ).toBe(true);
    await user.type(
      screen.getByRole("textbox", { name: "Find in file" }),
      "value"
    );
    await user.click(screen.getByRole("button", { name: "Next match" }));
    expect(onStep).toHaveBeenLastCalledWith("next");
    await user.click(screen.getByRole("button", { name: "Previous match" }));
    expect(onStep).toHaveBeenLastCalledWith("previous");
  });

  it("offers the same three modifiers the content search does", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    for (const label of [
      "Match case",
      "Match whole word",
      "Use regular expression",
    ]) {
      const toggle = screen.getByRole("button", { name: label });
      expect(toggle.getAttribute("aria-pressed")).toBe("false");
      await user.click(toggle);
      expect(
        screen.getByRole("button", { name: label }).getAttribute("aria-pressed")
      ).toBe("true");
    }
  });

  it("closes on Escape and from its own button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Close find" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
