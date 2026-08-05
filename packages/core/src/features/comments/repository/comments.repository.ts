import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
  NoRepoSelected,
  NotFound,
  StorageError,
} from "../../../shared.ts";
import type { CommentSide, ReviewComment } from "../schema/comments.schema.ts";

export interface AddCommentInput {
  readonly filePath: string;
  readonly side: CommentSide;
  readonly lineNumber: number;
  readonly body: string;
  readonly author: string;
  readonly target: string;
}
export interface UpdateCommentInput {
  readonly body: string;
}
export type CommentsFailure = NoRepoSelected | NotFound | StorageError;
export interface CommentsRepo {
  readonly list: Effect.Effect<ReadonlyArray<ReviewComment>, CommentsFailure>;
  readonly add: (
    input: AddCommentInput
  ) => Effect.Effect<ReviewComment, CommentsFailure>;
  readonly update: (
    id: string,
    input: UpdateCommentInput
  ) => Effect.Effect<ReviewComment, CommentsFailure>;
  readonly remove: (id: string) => Effect.Effect<void, CommentsFailure>;
}
export class CommentsRepository extends Context.Service<
  CommentsRepository,
  CommentsRepo
>()("CommentsRepository") {}
