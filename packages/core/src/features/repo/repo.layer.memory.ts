import * as Layer from "effect/Layer"
import { RepoRepository } from "./repo.repository.ts"
import {
  makeMemoryRepoRepository,
  type MemoryRepoSeed,
} from "./repo.repository.memory.ts"
import { make, RepoService } from "./repo.service.ts"

export const RepoMemory = (seed: MemoryRepoSeed = {}) =>
  Layer.effect(RepoService)(make).pipe(
    Layer.provide(Layer.effect(RepoRepository)(makeMemoryRepoRepository(seed)))
  )
