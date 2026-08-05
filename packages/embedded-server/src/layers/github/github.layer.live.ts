import * as Layer from "effect/Layer";
import { GitProvider } from "@byconvo/core/ports/git-provider";
import { makeGitHubProvider } from "./github.repository.git.ts";

export const GitHubLive = Layer.effect(GitProvider)(makeGitHubProvider);
