import { describe, expect, it } from "vitest";
import { deriveChromeTokens } from "./chrome.functions.ts";
import { contrast, luminance, parseHex } from "./hex-color.functions.ts";
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  describeThemes,
  loadTheme,
} from "../catalog/theme-catalog.ts";

const rgb = (color: string) => parseHex(color)!;

describe("deriveChromeTokens", () => {
  it("paints the app's own themes as the stylesheet does", async () => {
    const dark = deriveChromeTokens((await loadTheme(DEFAULT_DARK_THEME))!);
    expect(dark.colorScheme).toBe("dark");
    expect(dark.island).toBe("#141417");
    expect(dark.frame).toBe("#000000");
    expect(dark.text).toBe("#fafafa");
    const light = deriveChromeTokens((await loadTheme(DEFAULT_LIGHT_THEME))!);
    expect(light.colorScheme).toBe("light");
    expect(light.island).toBe("#ffffff");
    expect(light.frame).toBe("#f0f0f3");
  });

  it("keeps the ladder of surfaces in order for every bundled theme", async () => {
    for (const { name, colorScheme } of describeThemes()) {
      const theme = await loadTheme(name);
      expect(theme, name).toBeDefined();
      const chrome = deriveChromeTokens(theme!);
      const island = rgb(chrome.island);
      const control = rgb(chrome.control);
      expect(chrome.colorScheme, name).toBe(colorScheme);
      // A control stands above the sheet in the dark and below it in the light.
      const step = luminance(control) - luminance(island);
      expect(
        colorScheme === "dark" ? step > 0 : step < 0,
        `${name} control`
      ).toBe(true);
      // Type reads on the sheet; the accent stands off it.
      expect(
        contrast(rgb(chrome.text), island),
        `${name} text`
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(rgb(chrome.textSecondary), island),
        `${name} muted`
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(rgb(chrome.accent), island),
        `${name} accent`
      ).toBeGreaterThanOrEqual(5.5);
      // A row's fills can be told from the row.
      expect(chrome.hover, `${name} hover`).not.toBe(chrome.island);
      expect(chrome.selection, `${name} selection`).not.toBe(chrome.island);
      // Rules are washes, never solid.
      expect(chrome.separator, `${name} separator`).toHaveLength(9);
    }
  });
});
