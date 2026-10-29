/**
 * The catalog and the highlighter behind core's `ThemeLibrary` port — what
 * the server hands `ThemesService`, so the HTTP API lists, resolves and
 * colours with the very themes the web app paints in.
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  ThemeLibrary,
  type ThemeLibraryShape,
} from "@reviewer/core/ports/theme-library";
import { ThemeNotFound } from "@reviewer/core/themes";
import {
  describeTheme,
  describeThemes,
  findTheme,
  loadTheme,
} from "./catalog.ts";
import { highlightCode } from "./highlight.ts";

const load: ThemeLibraryShape["load"] = (name) => {
  const entry = findTheme(name);
  const loading = loadTheme(name);
  if (entry === undefined || loading === undefined)
    return Effect.fail(new ThemeNotFound({ name }));
  return Effect.promise(() => loading).pipe(
    Effect.map((theme) => ({ descriptor: describeTheme(entry), theme }))
  );
};

export const catalogThemeLibrary: ThemeLibraryShape = {
  themes: describeThemes(),
  load,
  highlight: (name, { code, lang }) =>
    load(name).pipe(
      Effect.flatMap(({ theme }) =>
        Effect.promise(() => highlightCode(code, lang, theme))
      )
    ),
};

export const ThemeLibraryLive =
  Layer.succeed(ThemeLibrary)(catalogThemeLibrary);
