import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type {
  NoRepoSelected,
  NotFound,
  StorageError,
} from "../../../shared.ts"
import type {
  AddVisualComment,
  VisualComment,
} from "../schema/visual-comments.schema.ts"

export interface UpdateVisualCommentInput {
  readonly body: string
}
export type VisualCommentsFailure = NoRepoSelected | NotFound | StorageError
export interface VisualCommentsRepo {
  readonly list: Effect.Effect<
    ReadonlyArray<VisualComment>,
    VisualCommentsFailure
  >
  readonly add: (
    input: AddVisualComment
  ) => Effect.Effect<VisualComment, VisualCommentsFailure>
  readonly update: (
    id: string,
    input: UpdateVisualCommentInput
  ) => Effect.Effect<VisualComment, VisualCommentsFailure>
  readonly remove: (id: string) => Effect.Effect<void, VisualCommentsFailure>
}
export class VisualCommentsRepository extends Context.Service<
  VisualCommentsRepository,
  VisualCommentsRepo
>()("VisualCommentsRepository") {}
