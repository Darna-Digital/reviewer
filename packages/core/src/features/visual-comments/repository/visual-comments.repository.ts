import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
  NoRepoSelected,
  NotFound,
  StorageError,
} from "../../../shared.ts";
import type {
  VisualComment,
  Viewport,
} from "../schema/visual-comments.schema.ts";

export interface AddVisualCommentInput {
  readonly url: string;
  readonly selector: string;
  readonly elementLabel: string;
  readonly body: string;
  readonly author: string;
  readonly screenshot: string | null;
  readonly viewport: Viewport;
}
export interface UpdateVisualCommentInput {
  readonly body: string;
}
export type VisualCommentsFailure = NoRepoSelected | NotFound | StorageError;

export interface VisualCommentsRepo {
  readonly list: Effect.Effect<
    ReadonlyArray<VisualComment>,
    VisualCommentsFailure
  >;
  readonly add: (
    input: AddVisualCommentInput
  ) => Effect.Effect<VisualComment, VisualCommentsFailure>;
  readonly update: (
    id: string,
    input: UpdateVisualCommentInput
  ) => Effect.Effect<VisualComment, VisualCommentsFailure>;
  readonly remove: (id: string) => Effect.Effect<void, VisualCommentsFailure>;
}

export class VisualCommentsRepository extends Context.Service<
  VisualCommentsRepository,
  VisualCommentsRepo
>()("VisualCommentsRepository") {}
