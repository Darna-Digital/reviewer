import { describe, expect, it } from "vitest";
import { deriveSyntaxTokens } from "./syntax.functions.ts";

describe("deriveSyntaxTokens", () => {
  it("prefers the narrowest rule that names a scope", () => {
    const tokens = deriveSyntaxTokens({
      fg: "#111111",
      tokenColors: [
        { scope: "entity", settings: { foreground: "#aaaaaa" } },
        { scope: "entity.name.function", settings: { foreground: "#bbbbbb" } },
        { scope: "source.js keyword", settings: { foreground: "#cccccc" } },
      ],
    });
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
    });
    expect(tokens.comment).toBe("#00ff00");
    expect(tokens.string).toBe("#00ff00");
    expect(tokens.keyword).toBe("inherit");
  });
});
