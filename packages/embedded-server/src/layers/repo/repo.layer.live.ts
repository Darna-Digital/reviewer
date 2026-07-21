import * as Layer from "effect/Layer"
import {
  RepoRepository,
  makeRepoService,
  RepoService,
} from "@byconvo/core/repo"
import { makeGitRepoRepository } from "./repo.repository.git.ts"

export const RepoLive = Layer.effect(RepoService)(makeRepoService).pipe(
  Layer.provide(Layer.effect(RepoRepository)(makeGitRepoRepository))
)
