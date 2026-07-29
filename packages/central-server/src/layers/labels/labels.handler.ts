import * as Effect from "effect/Effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../../api.ts"
import { labelsService } from "../../services.ts"

const ok = { ok: true } as const

export const LabelsHandler = HttpApiBuilder.group(Api, "labels", (handlers) =>
  handlers
    .handle("list", ({ query }) =>
      Effect.flatMap(labelsService, (s) => s.listByProject(query.projectId))
    )
    .handle("create", ({ payload }) =>
      Effect.flatMap(labelsService, (s) => s.create(payload))
    )
    .handle("update", ({ params, payload }) =>
      Effect.flatMap(labelsService, (s) => s.update(params.id, payload))
    )
    .handle("remove", ({ params }) =>
      Effect.flatMap(labelsService, (s) => s.remove(params.id)).pipe(
        Effect.as(ok)
      )
    )
)
