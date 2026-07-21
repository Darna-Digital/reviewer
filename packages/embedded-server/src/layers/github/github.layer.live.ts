import * as Layer from "effect/Layer"
import {
  GitHubRepository,
  GitHubService,
  makeGitHubService,
} from "@byconvo/core"
import { makeGitHubRepository } from "./github.repository.git.ts"

export const GitHubLive = Layer.effect(GitHubService)(makeGitHubService).pipe(
  Layer.provide(Layer.effect(GitHubRepository)(makeGitHubRepository))
)
