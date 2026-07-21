import * as Layer from "effect/Layer"
import { WorkspaceRepository } from "../repository/workspace.repository.ts"
import {
  makeMemoryWorkspaceRepository,
  type MemoryWorkspaceSeed,
} from "../repository/workspace.repository.memory.ts"
import {
  makeWorkspaceService,
  WorkspaceService,
} from "../service/workspace.service.ts"

export const WorkspaceMemory = (seed: MemoryWorkspaceSeed = {}) =>
  Layer.effect(WorkspaceService)(makeWorkspaceService).pipe(
    Layer.provide(
      Layer.effect(WorkspaceRepository)(makeMemoryWorkspaceRepository(seed))
    )
  )
