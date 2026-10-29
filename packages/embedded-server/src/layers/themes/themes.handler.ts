import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/http-api";
import { Api } from "../../api.ts";
import { ThemesService } from "@reviewer/core/themes";

export const ThemesHandler = HttpApiBuilder.group(Api, "themes", (handlers) =>
  handlers
    .handle("list", () => Effect.map(ThemesService, (s) => s.list))
    .handle("chrome", ({ params }) =>
      Effect.flatMap(ThemesService, (s) => s.chrome(params.name))
    )
    .handle("highlight", ({ params, payload }) =>
      Effect.flatMap(ThemesService, (s) => s.highlight(params.name, payload))
    )
);
