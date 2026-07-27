import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import { NotFound } from "../../../shared.ts"
import type { VisualComment } from "../schema/visual-comments.schema.ts"
import type { VisualCommentsRepo } from "./visual-comments.repository.ts"

export const makeMemoryVisualCommentsRepository = (
  seed: ReadonlyArray<VisualComment> = []
) =>
  Effect.gen(function* () {
    const store = yield* Ref.make<ReadonlyArray<VisualComment>>([...seed])
    let counter = 0
    const repo: VisualCommentsRepo = {
      list: Ref.get(store),
      add: (comment) =>
        Effect.gen(function* () {
          counter += 1
          const created: VisualComment = {
            ...comment,
            id: `v-mem-${counter}`,
            createdAt: "2026-01-01T00:00:00.000Z",
          }
          yield* Ref.update(store, (all) => [...all, created])
          return created
        }),
      update: (id, input) =>
        Effect.gen(function* () {
          const all = yield* Ref.get(store)
          const existing = all.find((c) => c.id === id)
          if (existing === undefined) {
            return yield* Effect.fail(
              new NotFound({ reason: `visual comment ${id} not found` })
            )
          }
          const updated: VisualComment = { ...existing, body: input.body }
          yield* Ref.update(store, (comments) =>
            comments.map((c) => (c.id === id ? updated : c))
          )
          return updated
        }),
      remove: (id) =>
        Ref.update(store, (all) => all.filter((c) => c.id !== id)),
    }
    return repo
  })
