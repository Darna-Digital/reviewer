import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { Conflict, NotFound, StorageError } from "../../../shared.ts"
import type { Doc, DocSummary } from "../schema/docs.schema.ts"

export interface CreateDocInput {
  readonly projectId: string
  readonly title: string
  readonly content: string
}

export interface UpdateDocInput {
  readonly title?: string
  readonly content?: string
}

export type DocsFailure = NotFound | Conflict | StorageError

export interface DocsRepo {
  readonly listByProject: (
    projectId: string
  ) => Effect.Effect<ReadonlyArray<DocSummary>, DocsFailure>
  readonly get: (id: string) => Effect.Effect<Doc, DocsFailure>
  readonly create: (input: CreateDocInput) => Effect.Effect<Doc, DocsFailure>
  readonly update: (
    id: string,
    input: UpdateDocInput
  ) => Effect.Effect<Doc, DocsFailure>
  readonly remove: (id: string) => Effect.Effect<void, DocsFailure>
}

export class DocsRepository extends Context.Service<DocsRepository, DocsRepo>()(
  "DocsRepository"
) {}
