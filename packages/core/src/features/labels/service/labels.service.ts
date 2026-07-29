import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { Conflict, InvalidInput } from "../../../shared.ts"
import {
  LabelsRepository,
  type LabelsFailure,
  type LabelsRepo,
} from "../repository/labels.repository.ts"
import type {
  Label,
  NewLabel,
  UpdateLabel,
} from "../schema/labels.schema.ts"
import {
  labelNamesClash,
  nextLabelColor,
  normalizeLabelName,
  sortLabels,
} from "../functions/labels.functions.ts"

export type LabelsServiceFailure = LabelsFailure | InvalidInput

export interface LabelsServiceShape {
  readonly listByProject: (
    projectId: string
  ) => Effect.Effect<ReadonlyArray<Label>, LabelsServiceFailure>
  readonly get: (id: string) => Effect.Effect<Label, LabelsServiceFailure>
  readonly create: (
    input: NewLabel
  ) => Effect.Effect<Label, LabelsServiceFailure>
  readonly update: (
    id: string,
    input: UpdateLabel
  ) => Effect.Effect<Label, LabelsServiceFailure>
  readonly remove: (id: string) => Effect.Effect<void, LabelsServiceFailure>
}

export class LabelsService extends Context.Service<
  LabelsService,
  LabelsServiceShape
>()("LabelsService") {}

/**
 * Labels are project-scoped and named by hand, so the rules are about names:
 * normalize what was typed, refuse an empty one, and refuse a duplicate within
 * the same project. A label created without a colour gets the first one its
 * project has not used yet.
 */
export const makeLabelsService = Effect.gen(function* () {
  const repo: LabelsRepo = yield* LabelsRepository

  const listByProject: LabelsServiceShape["listByProject"] = (projectId) =>
    Effect.map(repo.listByProject(projectId), sortLabels)

  const requireName = (name: string): Effect.Effect<string, InvalidInput> => {
    const normalized = normalizeLabelName(name)
    return normalized.length === 0
      ? Effect.fail(new InvalidInput({ reason: "a label needs a name" }))
      : Effect.succeed(normalized)
  }

  const requireUnique = (
    projectId: string,
    name: string,
    excludeId: string | null
  ): Effect.Effect<void, LabelsServiceFailure> =>
    Effect.flatMap(repo.listByProject(projectId), (existing) =>
      existing.some((l) => l.id !== excludeId && labelNamesClash(l.name, name))
        ? Effect.fail(
            new Conflict({ reason: `this project already has a "${name}" label` })
          )
        : Effect.void
    )

  const create: LabelsServiceShape["create"] = (input) =>
    Effect.gen(function* () {
      const name = yield* requireName(input.name)
      yield* requireUnique(input.projectId, name, null)
      const existing = yield* repo.listByProject(input.projectId)
      return yield* repo.create({
        projectId: input.projectId,
        name,
        color: input.color ?? nextLabelColor(existing),
      })
    })

  const update: LabelsServiceShape["update"] = (id, input) =>
    Effect.gen(function* () {
      const existing = yield* repo.get(id)
      const name =
        input.name === undefined ? undefined : yield* requireName(input.name)
      if (name !== undefined) {
        yield* requireUnique(existing.projectId, name, id)
      }
      return yield* repo.update(id, {
        ...(name === undefined ? {} : { name }),
        ...(input.color === undefined ? {} : { color: input.color }),
      })
    })

  return LabelsService.of({
    listByProject,
    get: repo.get,
    create,
    update,
    remove: repo.remove,
  })
})
