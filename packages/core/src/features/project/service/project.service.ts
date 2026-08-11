import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import {
  ProjectRepository,
  type ProjectRepo,
} from "../repository/project.repository.ts";

export interface ProjectServiceShape extends ProjectRepo {}
export class ProjectService extends Context.Service<
  ProjectService,
  ProjectServiceShape
>()("ProjectService") {}
export const makeProjectService = Effect.gen(function* () {
  const repo = yield* ProjectRepository;
  return ProjectService.of(repo);
});
