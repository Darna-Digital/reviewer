import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import {
  WorkspaceRepository,
  type WorkspaceRepo,
} from "./workspace.repository.ts"

export interface WorkspaceServiceShape extends WorkspaceRepo {}
export class WorkspaceService extends Context.Service<
  WorkspaceService,
  WorkspaceServiceShape
>()("WorkspaceService") {}
export const make = Effect.gen(function* () {
  const repo = yield* WorkspaceRepository
  return WorkspaceService.of(repo)
})
