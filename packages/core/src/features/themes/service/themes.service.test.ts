import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import type { LoadedTheme } from "../../../ports/theme-library.ts";
import { ThemesMemory } from "../layer/themes.layer.memory.ts";
import { ThemesService } from "./themes.service.ts";

const midnight: LoadedTheme = {
  descriptor: {
    name: "midnight",
    displayName: "Midnight",
    colorScheme: "dark",
    collection: "test",
  },
  theme: {
    type: "dark",
    bg: "#101014",
    fg: "#e8e8ea",
    colors: { "sideBar.background": "#000000", focusBorder: "#5abeff" },
  },
};

describe("ThemesService", () => {
  it.effect("lists the library's themes in its order", () =>
    Effect.gen(function* () {
      const themes = yield* ThemesService;
      expect(themes.list.map((theme) => theme.name)).toEqual(["midnight"]);
    }).pipe(Effect.provide(ThemesMemory([midnight])))
  );

  it.effect("resolves a theme to its descriptor and chrome", () =>
    Effect.gen(function* () {
      const themes = yield* ThemesService;
      const { theme, chrome } = yield* themes.chrome("midnight");
      expect(theme).toEqual(midnight.descriptor);
      expect(chrome.colorScheme).toBe("dark");
      expect(chrome.island).toBe("#101014");
      expect(chrome.frame).toBe("#000000");
    }).pipe(Effect.provide(ThemesMemory([midnight])))
  );

  it.effect("fails with ThemeNotFound for a name the library lacks", () =>
    Effect.gen(function* () {
      const themes = yield* ThemesService;
      const chrome = yield* Effect.flip(themes.chrome("daylight"));
      const highlight = yield* Effect.flip(
        themes.highlight("daylight", { code: "x", lang: "ts" })
      );
      expect(chrome._tag).toBe("ThemeNotFound");
      expect(highlight.name).toBe("daylight");
    }).pipe(Effect.provide(ThemesMemory([midnight])))
  );
});
