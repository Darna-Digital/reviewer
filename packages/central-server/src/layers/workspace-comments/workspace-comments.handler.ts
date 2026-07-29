import * as Effect from "effect/Effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../../api.ts"
import { workspaceCommentsService } from "../../services.ts"

const ok = { ok: true } as const

export const WorkspaceCommentsHandler = HttpApiBuilder.group(
  Api,
  "comments",
  (handlers) =>
    handlers
      .handle("list", ({ query }) =>
        Effect.flatMap(workspaceCommentsService, (s) =>
          s.listBySubject(query.subjectType, query.subjectId)
        )
      )
      .handle("create", ({ payload }) =>
        Effect.flatMap(workspaceCommentsService, (s) => s.create(payload))
      )
      .handle("update", ({ params, payload }) =>
        Effect.flatMap(workspaceCommentsService, (s) =>
          s.update(params.id, payload.body)
        )
      )
      .handle("remove", ({ params }) =>
        Effect.flatMap(workspaceCommentsService, (s) =>
          s.remove(params.id)
        ).pipe(Effect.as(ok))
      )
)
