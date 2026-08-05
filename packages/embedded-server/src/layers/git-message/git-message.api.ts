/** HTTP endpoint for AI commit-message drafting. */
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { GitError } from "@byconvo/core/ports/git-exec";
import { TerminalError } from "@byconvo/core/ports/terminal-exec";
import { NoRepoSelected } from "@byconvo/core/shared";
import { GeneratedMessage, GenerateBody } from "@byconvo/core/git-message";

export class GitMessageApi extends HttpApiGroup.make("gitMessage").add(
  HttpApiEndpoint.post("generate", "/git-message/generate", {
    payload: GenerateBody,
    success: GeneratedMessage,
    error: [GitError, NoRepoSelected, TerminalError] as const,
  })
) {}
