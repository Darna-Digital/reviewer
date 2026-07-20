/** HTTP endpoint for AI commit-message drafting. */
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import {
  GitError,
  NoRepoSelected,
  TerminalError,
} from "../../../layers/errors.ts"
import { GeneratedMessage, GenerateBody } from "@byconvo/models/git-message"

export class GitMessageApi extends HttpApiGroup.make("gitMessage").add(
  HttpApiEndpoint.post("generate", "/git-message/generate", {
    payload: GenerateBody,
    success: GeneratedMessage,
    error: [GitError, NoRepoSelected, TerminalError] as const,
  })
) {}
