import * as Layer from "effect/Layer"
import { GitHubRepository } from "./github.repository.ts"
import {
  makeMemoryGitHubRepository,
  type MemoryGitHubSeed,
} from "./github.repository.memory.ts"
import { GitHubService, make } from "./github.service.ts"

export const GitHubMemory = (seed: MemoryGitHubSeed = {}) =>
  Layer.effect(GitHubService)(make).pipe(
    Layer.provide(
      Layer.effect(GitHubRepository)(makeMemoryGitHubRepository(seed))
    )
  )
