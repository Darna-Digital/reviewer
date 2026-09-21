import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import {
  deriveChromeTokens,
  describeTheme,
  describeThemes,
  findTheme,
  loadTheme,
  ThemeNotFound,
} from "@reviewer/core/themes";

export const ThemesHandler = HttpApiBuilder.group(Api, "themes", (handlers) =>
  handlers
    .handle("list", () => Effect.succeed(describeThemes()))
    .handle("chrome", ({ params }) =>
      Effect.gen(function* () {
        const entry = findTheme(params.name);
        const loading = loadTheme(params.name);
        if (entry === undefined || loading === undefined)
          return yield* new ThemeNotFound({ name: params.name });
        const theme = yield* Effect.promise(() => loading);
        return {
          theme: describeTheme(entry),
          chrome: deriveChromeTokens(theme),
        };
      })
    )
);
