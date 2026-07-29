/**
 * The live services, built per request.
 *
 * Each one is the same object `@byconvo/core` builds for its own tests, with a
 * drizzle repository underneath instead of an in-memory one — the service layer
 * never learns that Postgres exists. Building them per request rather than once
 * is what keeps the tenant honest: the repository closes over the viewer's
 * organization, so a query that forgot to scope itself cannot compile.
 */
import { DocsRepository, makeDocsService } from "@byconvo/core/docs"
import { LabelsRepository, makeLabelsService } from "@byconvo/core/labels"
import { ProjectsRepository, makeProjectsService } from "@byconvo/core/projects"
import { TasksRepository, makeTasksService } from "@byconvo/core/tasks"
import {
  WorkspaceCommentsRepository,
  makeWorkspaceCommentsService,
} from "@byconvo/core/workspace-comments"
import * as Effect from "effect/Effect"
import { withViewer } from "./auth/viewer.ts"
import { makeDrizzleDocsRepository } from "./layers/docs/docs.repository.drizzle.ts"
import { makeDrizzleLabelsRepository } from "./layers/labels/labels.repository.drizzle.ts"
import { makeDrizzleProjectsRepository } from "./layers/projects/projects.repository.drizzle.ts"
import { makeDrizzleTasksRepository } from "./layers/tasks/tasks.repository.drizzle.ts"
import { makeDrizzleWorkspaceCommentsRepository } from "./layers/workspace-comments/workspace-comments.repository.drizzle.ts"

export const projectsService = withViewer(
  Effect.flatMap(makeDrizzleProjectsRepository, (repo) =>
    Effect.provideService(makeProjectsService, ProjectsRepository, repo)
  )
)

export const tasksService = withViewer(
  Effect.flatMap(makeDrizzleTasksRepository, (repo) =>
    Effect.provideService(makeTasksService, TasksRepository, repo)
  )
)

export const docsService = withViewer(
  Effect.flatMap(makeDrizzleDocsRepository, (repo) =>
    Effect.provideService(makeDocsService, DocsRepository, repo)
  )
)

export const labelsService = withViewer(
  Effect.flatMap(makeDrizzleLabelsRepository, (repo) =>
    Effect.provideService(makeLabelsService, LabelsRepository, repo)
  )
)

export const workspaceCommentsService = withViewer(
  Effect.flatMap(makeDrizzleWorkspaceCommentsRepository, (repo) =>
    Effect.provideService(
      makeWorkspaceCommentsService,
      WorkspaceCommentsRepository,
      repo
    )
  )
)
