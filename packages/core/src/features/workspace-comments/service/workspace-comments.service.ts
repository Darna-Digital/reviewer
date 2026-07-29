import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { Forbidden, InvalidInput } from "../../../shared.ts"
import {
  canDeleteComment,
  canEditComment,
} from "../../identity/functions/identity.functions.ts"
import { Viewer } from "../../identity/service/viewer.ts"
import {
  WorkspaceCommentsRepository,
  type WorkspaceCommentsFailure,
  type WorkspaceCommentsRepo,
} from "../repository/workspace-comments.repository.ts"
import type {
  CommentSubject,
  NewWorkspaceComment,
  WorkspaceComment,
} from "../schema/workspace-comments.schema.ts"
import {
  normalizeCommentBody,
  sortComments,
} from "../functions/workspace-comments.functions.ts"

export type WorkspaceCommentsServiceFailure =
  | WorkspaceCommentsFailure
  | InvalidInput
  | Forbidden

export interface WorkspaceCommentsServiceShape {
  readonly listBySubject: (
    subjectType: CommentSubject,
    subjectId: string
  ) => Effect.Effect<
    ReadonlyArray<WorkspaceComment>,
    WorkspaceCommentsServiceFailure
  >
  readonly get: (
    id: string
  ) => Effect.Effect<WorkspaceComment, WorkspaceCommentsServiceFailure>
  readonly create: (
    input: NewWorkspaceComment
  ) => Effect.Effect<WorkspaceComment, WorkspaceCommentsServiceFailure>
  readonly update: (
    id: string,
    body: string
  ) => Effect.Effect<WorkspaceComment, WorkspaceCommentsServiceFailure>
  readonly remove: (
    id: string
  ) => Effect.Effect<void, WorkspaceCommentsServiceFailure>
}

export class WorkspaceCommentsService extends Context.Service<
  WorkspaceCommentsService,
  WorkspaceCommentsServiceShape
>()("WorkspaceCommentsService") {}

/**
 * Threads on tasks and docs. The viewer is read once, when the service is
 * built for a request, so authorship and the edit/delete rules are settled
 * here rather than trusted from the payload.
 */
export const makeWorkspaceCommentsService = Effect.gen(function* () {
  const repo: WorkspaceCommentsRepo = yield* WorkspaceCommentsRepository
  const viewer = yield* Viewer

  const requireBody = (body: string): Effect.Effect<string, InvalidInput> => {
    const normalized = normalizeCommentBody(body)
    return normalized.length === 0
      ? Effect.fail(new InvalidInput({ reason: "a comment needs a body" }))
      : Effect.succeed(normalized)
  }

  const listBySubject: WorkspaceCommentsServiceShape["listBySubject"] = (
    subjectType,
    subjectId
  ) => Effect.map(repo.listBySubject(subjectType, subjectId), sortComments)

  const create: WorkspaceCommentsServiceShape["create"] = (input) =>
    Effect.gen(function* () {
      const body = yield* requireBody(input.body)
      const parentId = input.parentId ?? null
      if (parentId !== null) {
        // Replying to a comment on a different subject would put the reply
        // somewhere it can never be read.
        const parent = yield* repo.get(parentId)
        if (
          parent.subjectType !== input.subjectType ||
          parent.subjectId !== input.subjectId
        ) {
          return yield* Effect.fail(
            new InvalidInput({
              reason: "a reply must belong to the same task or doc as its parent",
            })
          )
        }
      }
      return yield* repo.create({
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        parentId,
        body,
        authorId: viewer.user.id,
      })
    })

  const update: WorkspaceCommentsServiceShape["update"] = (id, body) =>
    Effect.gen(function* () {
      const existing = yield* repo.get(id)
      if (!canEditComment(existing.author.id, viewer.user.id)) {
        return yield* Effect.fail(
          new Forbidden({ reason: "only the author can edit a comment" })
        )
      }
      return yield* repo.update(id, yield* requireBody(body))
    })

  const remove: WorkspaceCommentsServiceShape["remove"] = (id) =>
    Effect.gen(function* () {
      const existing = yield* repo.get(id)
      if (
        !canDeleteComment(viewer.role, existing.author.id, viewer.user.id)
      ) {
        return yield* Effect.fail(
          new Forbidden({
            reason: "only the author or an admin can delete a comment",
          })
        )
      }
      return yield* repo.remove(id)
    })

  return WorkspaceCommentsService.of({
    listBySubject,
    get: repo.get,
    create,
    update,
    remove,
  })
})
