import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { Conflict, NotFound, StorageError } from "../../../shared.ts"
import type { AccentColor } from "../../projects/schema/projects.schema.ts"
import type { Label } from "../schema/labels.schema.ts"

export interface CreateLabelInput {
  readonly projectId: string
  readonly name: string
  readonly color: AccentColor
}

export interface UpdateLabelInput {
  readonly name?: string
  readonly color?: AccentColor
}

export type LabelsFailure = NotFound | Conflict | StorageError

export interface LabelsRepo {
  readonly listByProject: (
    projectId: string
  ) => Effect.Effect<ReadonlyArray<Label>, LabelsFailure>
  readonly get: (id: string) => Effect.Effect<Label, LabelsFailure>
  readonly create: (
    input: CreateLabelInput
  ) => Effect.Effect<Label, LabelsFailure>
  readonly update: (
    id: string,
    input: UpdateLabelInput
  ) => Effect.Effect<Label, LabelsFailure>
  readonly remove: (id: string) => Effect.Effect<void, LabelsFailure>
}

export class LabelsRepository extends Context.Service<
  LabelsRepository,
  LabelsRepo
>()("LabelsRepository") {}
