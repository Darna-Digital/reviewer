import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import { NotFound } from "../../../shared.ts"
import type { Label } from "../schema/labels.schema.ts"
import type {
  CreateLabelInput,
  LabelsRepo,
  UpdateLabelInput,
} from "./labels.repository.ts"

const NOW = "2026-01-01T00:00:00.000Z"

export const makeMemoryLabelsRepository = (seed: ReadonlyArray<Label> = []) =>
  Effect.gen(function* () {
    const store = yield* Ref.make<ReadonlyArray<Label>>([...seed])
    let counter = seed.length

    const require = (id: string) =>
      Effect.flatMap(Ref.get(store), (all) => {
        const found = all.find((l) => l.id === id)
        return found === undefined
          ? Effect.fail(new NotFound({ reason: `label ${id} not found` }))
          : Effect.succeed(found)
      })

    const repo: LabelsRepo = {
      listByProject: (projectId) =>
        Effect.map(Ref.get(store), (all) =>
          all.filter((l) => l.projectId === projectId)
        ),
      get: require,
      create: (input: CreateLabelInput) =>
        Effect.gen(function* () {
          counter += 1
          const created: Label = {
            id: `label-mem-${counter}`,
            projectId: input.projectId,
            name: input.name,
            color: input.color,
            createdAt: NOW,
          }
          yield* Ref.update(store, (all) => [...all, created])
          return created
        }),
      update: (id, input: UpdateLabelInput) =>
        Effect.gen(function* () {
          const existing = yield* require(id)
          const updated: Label = {
            ...existing,
            name: input.name ?? existing.name,
            color: input.color ?? existing.color,
          }
          yield* Ref.update(store, (all) =>
            all.map((l) => (l.id === id ? updated : l))
          )
          return updated
        }),
      remove: (id) =>
        Effect.flatMap(require(id), () =>
          Ref.update(store, (all) => all.filter((l) => l.id !== id))
        ),
    }

    return repo
  })
