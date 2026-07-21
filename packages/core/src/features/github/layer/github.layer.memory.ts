import * as Layer from "effect/Layer"
import { GitHubRepository } from "../repository/github.repository.ts"
import {
  makeMemoryGitHubRepository,
  type MemoryGitHubSeed,
} from "../repository/github.repository.memory.ts"
import { GitHubService, makeGitHubService } from "../service/github.service.ts"

export const GitHubMemory = (seed: MemoryGitHubSeed = {}) =>
  Layer.effect(GitHubService)(makeGitHubService).pipe(
    Layer.provide(
      Layer.effect(GitHubRepository)(makeMemoryGitHubRepository(seed))
    )
  )
