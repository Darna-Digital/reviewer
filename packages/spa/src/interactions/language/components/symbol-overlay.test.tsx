// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SymbolReference, SymbolTarget } from "@byconvo/core/language";
import { HoverDocumentation, TargetChoice, UsagesList } from "./symbol-overlay";

afterEach(cleanup);

const at = (path: string, line: number) => ({
  path,
  range: { start: { line, character: 0 }, end: { line, character: 4 } },
});

const reference = (
  path: string,
  line: number,
  kind: SymbolReference["kind"]
): SymbolReference => ({
  location: at(path, line),
  kind,
  preview: `greet(${line})`,
});

const target = (path: string, kind: string): SymbolTarget => ({
  location: at(path, 3),
  name: "greet",
  kind,
  containerName: "",
  preview: "export function greet()",
});

/**
 * A signature is highlighted, so its text arrives as a span per token, and the
 * heading repeats a word that is also in the code under it. Both are read back
 * through the slots the chrome marks them with rather than by their text.
 */
const signatureOf = (container: HTMLElement) =>
  container.querySelector("pre")?.textContent?.trim() ?? "";
const symbolOf = (container: HTMLElement) =>
  container.querySelector("[data-slot='card-symbol']")?.textContent ?? "";
const chipsOf = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-slot='card-chip']")].map(
    (chip) => chip.textContent
  );

describe("HoverDocumentation", () => {
  it("heads the card with the hovered token and the kind the server named", () => {
    const { container } = render(
      <HoverDocumentation
        symbol="commit"
        contents={
          "```ts\n(method) Repository.commit(): void\n```\n\nRecords the staged changes."
        }
      />
    );
    expect(symbolOf(container)).toBe("commit");
    expect(chipsOf(container)).toEqual(["method"]);
    // The kind is in the heading now, so the signature stops repeating it.
    expect(signatureOf(container)).toBe("Repository.commit(): void");
    expect(screen.getByText("Records the staged changes.")).toBeTruthy();
  });

  it("keeps a signature the server gave no kind for", () => {
    const { container } = render(
      <HoverDocumentation
        symbol="gap"
        contents={"```css\ngap: <length>\n```"}
      />
    );
    expect(chipsOf(container)).toEqual([]);
    expect(signatureOf(container)).toBe("gap: <length>");
  });

  it("puts a trailing reference link in a footer that opens away from the app", () => {
    render(
      <HoverDocumentation
        symbol="gap"
        contents={
          "Sets the gutters.\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/CSS/gap)"
        }
      />
    );
    const link = screen.getByRole("link", { name: "MDN Reference" });
    expect(link.getAttribute("href")).toBe(
      "https://developer.mozilla.org/docs/Web/CSS/gap"
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("says so when the server answered with nothing", () => {
    render(<HoverDocumentation symbol="greet" contents="   " />);
    expect(screen.getByText("No information")).toBeTruthy();
  });
});

describe("UsagesList", () => {
  it("counts the usages against the symbol they belong to", () => {
    const { container } = render(
      <UsagesList
        symbol="greet"
        references={[reference("src/a/greet.ts", 0, "definition")]}
        onOpen={vi.fn()}
      />
    );
    expect(symbolOf(container)).toBe("greet");
    expect(screen.getByText("1 usage")).toBeTruthy();
    expect(chipsOf(container)).toEqual(["declaration"]);
  });

  it("marks what each usage does with the symbol", () => {
    const { container } = render(
      <UsagesList
        symbol="greet"
        references={[
          reference("src/a.ts", 0, "definition"),
          reference("src/b.ts", 1, "write"),
          reference("src/c.ts", 2, "read"),
        ]}
        onOpen={vi.fn()}
      />
    );
    expect(screen.getByText("3 usages")).toBeTruthy();
    expect(chipsOf(container)).toEqual(["declaration", "write", "read"]);
  });

  it("opens the location the row stands for", async () => {
    const onOpen = vi.fn();
    render(
      <UsagesList
        symbol="greet"
        references={[reference("src/a/greet.ts", 7, "read")]}
        onOpen={onOpen}
      />
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith(at("src/a/greet.ts", 7));
  });

  it("keeps the file name whole and clips the directory in front of it", () => {
    render(
      <UsagesList
        symbol="greet"
        references={[reference("src/deeply/nested/greet.ts", 4, "read")]}
        onOpen={vi.fn()}
      />
    );
    expect(screen.getByText("greet.ts")).toBeTruthy();
    expect(screen.getByText("src/deeply/nested")).toBeTruthy();
    // The separator belongs to the left-to-right half, or it lands in front of
    // the directory instead of between it and the file.
    expect(screen.getByText("/", { selector: "span" })).toBeTruthy();
    expect(screen.getByText(":5")).toBeTruthy();
  });
});

describe("TargetChoice", () => {
  it("names the symbol from the declarations it is offering", () => {
    const { container } = render(
      <TargetChoice
        targets={[target("src/a.ts", "function"), target("src/b.ts", "var")]}
        onOpen={vi.fn()}
      />
    );
    expect(symbolOf(container)).toBe("greet");
    expect(screen.getByText("2 declarations")).toBeTruthy();
    expect(chipsOf(container)).toEqual(["function", "var"]);
  });

  it("leaves the chip off a declaration the server did not classify", () => {
    const { container } = render(
      <TargetChoice targets={[target("src/a.ts", "")]} onOpen={vi.fn()} />
    );
    expect(screen.getByText("1 declaration")).toBeTruthy();
    expect(chipsOf(container)).toEqual([]);
  });
});
