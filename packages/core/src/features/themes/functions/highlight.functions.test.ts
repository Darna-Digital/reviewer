import { describe, expect, it } from "vitest";
import { grammarFor, highlightCode } from "./highlight.functions.ts";
import { DEFAULT_DARK_THEME, loadTheme } from "../catalog/theme-catalog.ts";

const theme = async () => (await loadTheme(DEFAULT_DARK_THEME))!;

const text = (lines: ReadonlyArray<ReadonlyArray<{ text: string }>>) =>
  lines.map((line) => line.map((token) => token.text).join("")).join("\n");

describe("grammarFor", () => {
  it("takes a fence's own name and its aliases", () => {
    expect(grammarFor("typescript")).toBe("typescript");
    expect(grammarFor("ts")).toBe("ts");
    expect(grammarFor("Swift")).toBe("swift");
  });

  it("reads a fence it cannot place as plain text", () => {
    expect(grammarFor("")).toBe("text");
    expect(grammarFor("not-a-language")).toBe("text");
  });
});

describe("highlightCode", () => {
  it("colours a snippet in the theme, keeping every character", async () => {
    const code = "const answer = 42; // the answer";
    const highlighted = await highlightCode(code, "ts", await theme());
    expect(highlighted.lang).toBe("ts");
    expect(text(highlighted.lines)).toBe(code);
    const colours = new Set(
      highlighted.lines.flat().flatMap((token) => token.color ?? [])
    );
    expect(colours.size).toBeGreaterThan(1);
  });

  it("gives every line of the snippet a line of tokens", async () => {
    const code = "a = 1\n\nb = 2\n";
    const highlighted = await highlightCode(code, "python", await theme());
    expect(highlighted.lines).toHaveLength(4);
    expect(text(highlighted.lines)).toBe(code);
  });

  it("leaves a fence with no language in one colour", async () => {
    const highlighted = await highlightCode("just words", "", await theme());
    expect(highlighted.lang).toBe("text");
    expect(
      highlighted.lines.flat().every((token) => token.color === undefined)
    ).toBe(true);
  });
});
