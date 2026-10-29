/**
 * What a shell asks of the theme catalog, answered through the
 * {@link ThemeLibrary} port: the list a picker shows, one theme resolved to
 * the chrome its window is painted in, and a snippet coloured in it. The
 * library supplies the themes; reading the chrome from one is core's own.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { ThemeLibrary } from "../../../ports/theme-library.ts";
import { deriveChromeTokens } from "../functions/chrome.functions.ts";
import type {
  HighlightedCode,
  HighlightRequest,
  ThemeChrome,
  ThemeDescriptor,
  ThemeNotFound,
} from "../schema/themes.schema.ts";

export interface ThemesServiceShape {
  readonly list: ReadonlyArray<ThemeDescriptor>;
  readonly chrome: (name: string) => Effect.Effect<ThemeChrome, ThemeNotFound>;
  readonly highlight: (
    name: string,
    request: HighlightRequest
  ) => Effect.Effect<HighlightedCode, ThemeNotFound>;
}

export class ThemesService extends Context.Service<
  ThemesService,
  ThemesServiceShape
>()("ThemesService") {}

export const makeThemesService = Effect.gen(function* () {
  const library = yield* ThemeLibrary;
  return {
    list: library.themes,
    chrome: (name) =>
      library.load(name).pipe(
        Effect.map(({ descriptor, theme }) => ({
          theme: descriptor,
          chrome: deriveChromeTokens(theme),
        }))
      ),
    highlight: library.highlight,
  } satisfies ThemesServiceShape;
});
