import * as Layer from "effect/Layer"
import { GitHubRepository, GitHubService, make } from "@byconvo/core/github"
import { makeGitHubRepository } from "./github.repository.git.ts"

export const GitHubLive = Layer.effect(GitHubService)(make).pipe(
  Layer.provide(Layer.effect(GitHubRepository)(makeGitHubRepository))
)
