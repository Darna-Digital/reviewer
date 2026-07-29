import * as Effect from "effect/Effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../../api.ts"
import { docsService } from "../../services.ts"

const ok = { ok: true } as const

export const DocsHandler = HttpApiBuilder.group(Api, "docs", (handlers) =>
  handlers
    .handle("list", ({ query }) =>
      Effect.flatMap(docsService, (s) => s.listByProject(query.projectId))
    )
    .handle("get", ({ params }) =>
      Effect.flatMap(docsService, (s) => s.get(params.id))
    )
    .handle("create", ({ payload }) =>
      Effect.flatMap(docsService, (s) => s.create(payload))
    )
    .handle("update", ({ params, payload }) =>
      Effect.flatMap(docsService, (s) => s.update(params.id, payload))
    )
    .handle("remove", ({ params }) =>
      Effect.flatMap(docsService, (s) => s.remove(params.id)).pipe(Effect.as(ok))
    )
)
