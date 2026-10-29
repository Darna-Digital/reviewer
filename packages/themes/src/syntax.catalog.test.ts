import { describe, expect, it } from "vitest";
import { deriveSyntaxTokens } from "@reviewer/core/themes";
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  describeThemes,
  loadTheme,
} from "./catalog.ts";

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
