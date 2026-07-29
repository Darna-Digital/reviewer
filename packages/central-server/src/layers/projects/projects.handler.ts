import * as Effect from "effect/Effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../../api.ts"
import { projectsService } from "../../services.ts"

const ok = { ok: true } as const

export const ProjectsHandler = HttpApiBuilder.group(
  Api,
  "projects",
  (handlers) =>
    handlers
      .handle("list", () => Effect.flatMap(projectsService, (s) => s.list))
      .handle("get", ({ params }) =>
        Effect.flatMap(projectsService, (s) => s.get(params.id))
      )
      .handle("create", ({ payload }) =>
        Effect.flatMap(projectsService, (s) => s.create(payload))
      )
      .handle("update", ({ params, payload }) =>
        Effect.flatMap(projectsService, (s) => s.update(params.id, payload))
      )
      .handle("remove", ({ params }) =>
        Effect.flatMap(projectsService, (s) => s.remove(params.id)).pipe(
          Effect.as(ok)
        )
      )
)
