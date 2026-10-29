import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  ThemeLibrary,
  type LoadedTheme,
  type ThemeLibraryShape,
} from "../../../ports/theme-library.ts";
import { ThemeNotFound } from "../schema/themes.schema.ts";
import { makeThemesService, ThemesService } from "../service/themes.service.ts";

/**
 * A library holding only the themes it is seeded with. It has no grammars, so
 * a snippet comes back as plain text: one uncoloured token per line.
 */
export const makeMemoryThemeLibrary = (
  seed: ReadonlyArray<LoadedTheme>
): ThemeLibraryShape => {
  const byName = new Map(seed.map((entry) => [entry.descriptor.name, entry]));
  const load = (name: string) => {
    const entry = byName.get(name);
    return entry === undefined
      ? Effect.fail(new ThemeNotFound({ name }))
      : Effect.succeed(entry);
  };
  return {
    themes: seed.map((entry) => entry.descriptor),
    load,
    highlight: (name, { code }) =>
      load(name).pipe(
        Effect.as({
          lang: "text",
          lines: code.split("\n").map((text) => [{ text }]),
        })
      ),
  };
};

export const ThemesMemory = (seed: ReadonlyArray<LoadedTheme> = []) =>
  Layer.effect(ThemesService)(makeThemesService).pipe(
    Layer.provide(Layer.succeed(ThemeLibrary)(makeMemoryThemeLibrary(seed)))
  );
