import * as Layer from "effect/Layer"
import {
  WorkspaceRepository,
  make,
  WorkspaceService,
} from "@byconvo/core/workspace"
import { makeGitWorkspaceRepository } from "../repositories/workspace.repository.git.ts"

export const WorkspaceLive = Layer.effect(WorkspaceService)(make).pipe(
  Layer.provide(Layer.effect(WorkspaceRepository)(makeGitWorkspaceRepository))
)
