import * as Effect from "effect/Effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../../api.ts"
import { tasksService } from "../../services.ts"

const ok = { ok: true } as const

export const TasksHandler = HttpApiBuilder.group(Api, "tasks", (handlers) =>
  handlers
    .handle("list", ({ query }) =>
      Effect.flatMap(tasksService, (s) => s.listByProject(query.projectId))
    )
    .handle("get", ({ params }) =>
      Effect.flatMap(tasksService, (s) => s.get(params.id))
    )
    .handle("resolve", ({ params }) =>
      Effect.flatMap(tasksService, (s) => s.resolveRef(params.ref))
    )
    .handle("create", ({ payload }) =>
      Effect.flatMap(tasksService, (s) => s.create(payload))
    )
    .handle("update", ({ params, payload }) =>
      Effect.flatMap(tasksService, (s) => s.update(params.id, payload))
    )
    .handle("move", ({ params, payload }) =>
      Effect.flatMap(tasksService, (s) =>
        s.move(params.id, payload.status, payload.index)
      )
    )
    .handle("remove", ({ params }) =>
      Effect.flatMap(tasksService, (s) => s.remove(params.id)).pipe(
        Effect.as(ok)
      )
    )
)
