import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { FormattingService } from "@reviewer/core/formatting";
import { Api } from "../../api.ts";

export const FormattingHandler = HttpApiBuilder.group(
  Api,
  "formatting",
  (handlers) =>
    handlers
      .handle("formatter", () =>
        Effect.flatMap(FormattingService, (s) => s.formatter)
      )
      .handle("format", ({ payload }) =>
        Effect.flatMap(FormattingService, (s) =>
          s.format(payload.path, payload.contents)
        )
      )
);
