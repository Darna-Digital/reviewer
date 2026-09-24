import { describe, expect, it } from "vitest";
import { deriveSyntaxTokens } from "./syntax.functions.ts";
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  describeThemes,
  loadTheme,
} from "../catalog/theme-catalog.ts";

describe("deriveSyntaxTokens", () => {
  it("reads the app's own themes as GitHub's palette", async () => {
    const light = deriveSyntaxTokens((await loadTheme(DEFAULT_LIGHT_THEME))!);
    expect(light).toEqual({
      keyword: "#d73a49",
      entity: "#6f42c1",
      constant: "#005cc5",
      string: "#032f62",
      variable: "#e36209",
      comment: "#6a737d",
      tag: "#22863a",
    });
    const dark = deriveSyntaxTokens((await loadTheme(DEFAULT_DARK_THEME))!);
    expect(dark.keyword).toBe("#f97583");
    expect(dark.comment).toBe("#6a737d");
  });

  it("prefers the narrowest rule that names a scope", () => {
    const tokens = deriveSyntaxTokens({
      fg: "#111111",
      tokenColors: [
        { scope: "entity", settings: { foreground: "#aaaaaa" } },
        { scope: "entity.name.function", settings: { foreground: "#bbbbbb" } },
        { scope: "source.js keyword", settings: { foreground: "#cccccc" } },
      ],
    } as never);
    expect(tokens.entity).toBe("#bbbbbb");
    // A contextual selector says nothing about the plain scope, so the
    // keyword falls back to the colour plain code is set in.
    expect(tokens.keyword).toBe("#111111");
  });

  it("reads the older `settings` spelling of the rules", () => {
    const tokens = deriveSyntaxTokens({
      settings: [
        { scope: "comment, string", settings: { foreground: "#0f0" } },
      ],
    } as never);
    expect(tokens.comment).toBe("#00ff00");
    expect(tokens.string).toBe("#00ff00");
    expect(tokens.keyword).toBe("inherit");
  });

  it("answers every bundled theme in colours CSS can read", async () => {
    for (const { name } of describeThemes()) {
      const theme = await loadTheme(name);
      for (const [role, color] of Object.entries(deriveSyntaxTokens(theme!))) {
        expect(color, `${name} ${role}`).toMatch(
          /^(#[0-9a-f]{6}([0-9a-f]{2})?|inherit)$/
        );
      }
    }
  });
});
