import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import { NotFound } from "../../../shared.ts"
import { toDocSummary } from "../functions/docs.functions.ts"
import type { Doc } from "../schema/docs.schema.ts"
import type {
  CreateDocInput,
  DocsRepo,
  UpdateDocInput,
} from "./docs.repository.ts"

const NOW = "2026-01-01T00:00:00.000Z"

export const makeMemoryDocsRepository = (seed: ReadonlyArray<Doc> = []) =>
  Effect.gen(function* () {
    const store = yield* Ref.make<ReadonlyArray<Doc>>([...seed])
    let counter = seed.length

    const require = (id: string) =>
      Effect.flatMap(Ref.get(store), (all) => {
        const found = all.find((d) => d.id === id)
        return found === undefined
          ? Effect.fail(new NotFound({ reason: `doc ${id} not found` }))
          : Effect.succeed(found)
      })

    const repo: DocsRepo = {
      listByProject: (projectId) =>
        Effect.map(Ref.get(store), (all) =>
          all.filter((d) => d.projectId === projectId).map(toDocSummary)
        ),
      get: require,
      create: (input: CreateDocInput) =>
        Effect.gen(function* () {
          counter += 1
          const created: Doc = {
            id: `doc-mem-${counter}`,
            projectId: input.projectId,
            title: input.title,
            content: input.content,
            createdAt: NOW,
            updatedAt: NOW,
          }
          yield* Ref.update(store, (all) => [...all, created])
          return created
        }),
      update: (id, input: UpdateDocInput) =>
        Effect.gen(function* () {
          const existing = yield* require(id)
          const updated: Doc = {
            ...existing,
            title: input.title ?? existing.title,
            content: input.content ?? existing.content,
            updatedAt: NOW,
          }
          yield* Ref.update(store, (all) =>
            all.map((d) => (d.id === id ? updated : d))
          )
          return updated
        }),
      remove: (id) =>
        Effect.flatMap(require(id), () =>
          Ref.update(store, (all) => all.filter((d) => d.id !== id))
        ),
    }

    return repo
  })
