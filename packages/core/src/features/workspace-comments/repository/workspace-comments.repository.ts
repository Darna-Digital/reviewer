import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { NotFound, StorageError } from "../../../shared.ts"
import type {
  CommentSubject,
  WorkspaceComment,
} from "../schema/workspace-comments.schema.ts"

export interface CreateCommentInput {
  readonly subjectType: CommentSubject
  readonly subjectId: string
  readonly parentId: string | null
  readonly body: string
  /** The signed-in member posting; the repository joins their profile back. */
  readonly authorId: string
}

export type WorkspaceCommentsFailure = NotFound | StorageError

export interface WorkspaceCommentsRepo {
  readonly listBySubject: (
    subjectType: CommentSubject,
    subjectId: string
  ) => Effect.Effect<ReadonlyArray<WorkspaceComment>, WorkspaceCommentsFailure>
  readonly get: (
    id: string
  ) => Effect.Effect<WorkspaceComment, WorkspaceCommentsFailure>
  readonly create: (
    input: CreateCommentInput
  ) => Effect.Effect<WorkspaceComment, WorkspaceCommentsFailure>
  readonly update: (
    id: string,
    body: string
  ) => Effect.Effect<WorkspaceComment, WorkspaceCommentsFailure>
  /** Deletes the comment and every reply beneath it. */
  readonly remove: (id: string) => Effect.Effect<void, WorkspaceCommentsFailure>
}

export class WorkspaceCommentsRepository extends Context.Service<
  WorkspaceCommentsRepository,
  WorkspaceCommentsRepo
>()("WorkspaceCommentsRepository") {}
