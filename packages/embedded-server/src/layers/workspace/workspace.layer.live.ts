import * as Layer from "effect/Layer"
import {
  WorkspaceRepository,
  makeWorkspaceService,
  WorkspaceService,
} from "@byconvo/core/workspace"
import { makeGitWorkspaceRepository } from "./workspace.repository.git.ts"

export const WorkspaceLive = Layer.effect(WorkspaceService)(
  makeWorkspaceService
).pipe(
  Layer.provide(Layer.effect(WorkspaceRepository)(makeGitWorkspaceRepository))
)
