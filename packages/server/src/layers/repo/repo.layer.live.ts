import * as Layer from "effect/Layer"
import { RepoRepository, make, RepoService } from "@byconvo/core/repo"
import { makeGitRepoRepository } from "./repo.repository.git.ts"

export const RepoLive = Layer.effect(RepoService)(make).pipe(
  Layer.provide(Layer.effect(RepoRepository)(makeGitRepoRepository))
)
