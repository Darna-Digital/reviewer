import * as Layer from "effect/Layer"
import { ProjectsRepository } from "../repository/projects.repository.ts"
import { makeMemoryProjectsRepository } from "../repository/projects.repository.memory.ts"
import {
  ProjectsService,
  makeProjectsService,
} from "../service/projects.service.ts"
import type { Project } from "../schema/projects.schema.ts"

export const ProjectsMemory = (seed: ReadonlyArray<Project> = []) =>
  Layer.effect(ProjectsService)(makeProjectsService).pipe(
    Layer.provide(
      Layer.effect(ProjectsRepository)(makeMemoryProjectsRepository(seed))
    )
  )
