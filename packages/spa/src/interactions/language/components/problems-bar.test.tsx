// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProblemsBar } from "./problems-bar";
import { diagnostic, range } from "../functions/language.functions.mock";

afterEach(cleanup);

const problems = [
  diagnostic({
    severity: "warning",
    range: range(2, 0),
    message: "'x' is declared but its value is never read.",
    code: "6133",
  }),
  diagnostic({
    severity: "error",
    range: range(11, 4),
    message: "Type 'string' is not assignable to type 'number'.",
  }),
];

describe("ProblemsBar", () => {
  // The strip appearing is the signal; a clean file has no bar to notice.
  it("renders nothing for a clean file", () => {
    const { container } = render(
      <ProblemsBar
        diagnostics={[]}
        expanded={false}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("names its counts, worst first", () => {
    render(
      <ProblemsBar
        diagnostics={problems}
        expanded={false}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />
    );
    const toggle = screen.getByRole("button", {
      name: "Problems: 1 error, 1 warning",
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  // Collapsed, the worst problem is worth a glance without opening the list.
  it("previews the worst problem while collapsed", () => {
    render(
      <ProblemsBar
        diagnostics={problems}
        expanded={false}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />
    );
    expect(screen.queryByRole("list")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Problems:/ }).textContent
    ).toContain("Type 'string' is not assignable to type 'number'.");
  });

  it("asks to expand when the strip is pressed", async () => {
    const onToggle = vi.fn();
    render(
      <ProblemsBar
        diagnostics={problems}
        expanded={false}
        onToggle={onToggle}
        onSelect={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Problems:/ }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("lists the problems worst first once expanded", () => {
    render(
      <ProblemsBar
        diagnostics={problems}
        expanded={true}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain(
      "Type 'string' is not assignable to type 'number'."
    );
    // One-based position, as editors print it.
    expect(rows[0].textContent).toContain("12:5");
    expect(rows[1].textContent).toContain(
      "'x' is declared but its value is never read."
    );
  });

  it("hands the picked problem back for the jump", async () => {
    const onSelect = vi.fn();
    render(
      <ProblemsBar
        diagnostics={problems}
        expanded={true}
        onToggle={vi.fn()}
        onSelect={onSelect}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /never read/ }));
    expect(onSelect).toHaveBeenCalledWith(problems[0]);
  });

  it("copies the right-clicked problem with its location", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <ProblemsBar
        diagnostics={problems}
        expanded={true}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        path="src/main.ts"
      />
    );
    await userEvent.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: /never read/ }),
    });
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Copy problem" })
    );
    expect(writeText).toHaveBeenCalledWith(
      "src/main.ts:3:1 - warning ts(6133): 'x' is declared but its value is never read."
    );
  });

  it("copies every problem from the strip", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <ProblemsBar
        diagnostics={problems}
        expanded={false}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />
    );
    await userEvent.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: /Problems:/ }),
    });
    expect(screen.queryByRole("menuitem", { name: "Copy problem" })).toBeNull();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Copy all problems" })
    );
    expect(writeText).toHaveBeenCalledWith(
      [
        "12:5 - error ts(2322): Type 'string' is not assignable to type 'number'.",
        "3:1 - warning ts(6133): 'x' is declared but its value is never read.",
      ].join("\n")
    );
  });
});
