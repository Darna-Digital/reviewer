import * as Layer from "effect/Layer"
import { Viewer, type ViewerShape } from "../../identity/service/viewer.ts"
import { WorkspaceCommentsRepository } from "../repository/workspace-comments.repository.ts"
import { makeMemoryWorkspaceCommentsRepository } from "../repository/workspace-comments.repository.memory.ts"
import {
  WorkspaceCommentsService,
  makeWorkspaceCommentsService,
} from "../service/workspace-comments.service.ts"
import type {
  CommentAuthor,
  WorkspaceComment,
} from "../schema/workspace-comments.schema.ts"

/** A signed-in member, for tests that do not care who they are. */
export const testViewer = (over: Partial<ViewerShape> = {}): ViewerShape => ({
  user: {
    id: "u1",
    name: "Rūtenis",
    email: "r@example.com",
    emailVerified: true,
    image: null,
  },
  organization: {
    id: "org1",
    name: "Darna Digital",
    slug: "darna-digital",
    logo: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  role: "member",
  ...over,
})

export const WorkspaceCommentsMemory = (options: {
  readonly viewer?: ViewerShape
  readonly seed?: ReadonlyArray<WorkspaceComment>
  readonly authors?: Readonly<Record<string, CommentAuthor>>
} = {}) =>
  Layer.effect(WorkspaceCommentsService)(makeWorkspaceCommentsService).pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.effect(WorkspaceCommentsRepository)(
          makeMemoryWorkspaceCommentsRepository(
            options.seed ?? [],
            options.authors ?? {}
          )
        ),
        Layer.succeed(Viewer)(options.viewer ?? testViewer())
      )
    )
  )
