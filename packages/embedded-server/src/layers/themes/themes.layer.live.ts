import * as Layer from "effect/Layer";
import { makeThemesService, ThemesService } from "@reviewer/core/themes";
import { ThemeLibraryLive } from "@reviewer/themes";

export const ThemesLive = Layer.effect(ThemesService)(makeThemesService).pipe(
  Layer.provide(ThemeLibraryLive)
);
