import * as Effect from "effect/Effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../../api.ts"
import { VisualCommentsService } from "@byconvo/core/visual-comments"
import { PICKER_BUNDLE } from "@byconvo/visual-picker/bundle"

const ok = { ok: true } as const

export const VisualCommentsHandler = HttpApiBuilder.group(
  Api,
  "visualComments",
  (handlers) =>
    handlers
      .handle("picker", () => Effect.succeed(PICKER_BUNDLE))
      .handle("list", () =>
        Effect.flatMap(VisualCommentsService, (s) => s.list)
      )
      .handle("add", ({ payload }) =>
        Effect.flatMap(VisualCommentsService, (s) => s.add(payload))
      )
      .handle("update", ({ params, payload }) =>
        Effect.flatMap(VisualCommentsService, (s) =>
          s.update(params.id, payload.body)
        )
      )
      .handle("remove", ({ params }) =>
        Effect.flatMap(VisualCommentsService, (s) => s.remove(params.id)).pipe(
          Effect.as(ok)
        )
      )
)
