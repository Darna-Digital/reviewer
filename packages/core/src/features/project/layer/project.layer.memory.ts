import * as Layer from "effect/Layer";
import { ProjectRepository } from "../repository/project.repository.ts";
import {
  makeMemoryProjectRepository,
  type MemoryProjectSeed,
} from "../repository/project.repository.memory.ts";
import {
  makeProjectService,
  ProjectService,
} from "../service/project.service.ts";

export const ProjectMemory = (seed: MemoryProjectSeed = {}) =>
  Layer.effect(ProjectService)(makeProjectService).pipe(
    Layer.provide(
      Layer.effect(ProjectRepository)(makeMemoryProjectRepository(seed))
    )
  );
