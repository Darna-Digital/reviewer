import * as Layer from "effect/Layer";
import {
  ProjectRepository,
  makeProjectService,
  ProjectService,
} from "@reviewer/core/project";
import { makeGitProjectRepository } from "./project.repository.git.ts";

export const ProjectLive = Layer.effect(ProjectService)(
  makeProjectService
).pipe(
  Layer.provide(Layer.effect(ProjectRepository)(makeGitProjectRepository))
);
