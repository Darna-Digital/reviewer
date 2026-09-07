/**
 * HTTP endpoints for AI commit-message drafting. Starting a draft answers with
 * the run rather than the message — the CLI is still going when the response
 * is written — and the message is read off the draft once it lands.
 */
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { CommitDraft, GenerateBody } from "@reviewer/core/git-message";

export class GitMessageApi extends HttpApiGroup.make("gitMessage")
  .add(
    HttpApiEndpoint.post("generate", "/git-message/generate", {
      payload: GenerateBody,
      success: CommitDraft,
    })
  )
  .add(
    HttpApiEndpoint.get("draft", "/git-message/draft", {
      success: CommitDraft,
    })
  )
  .add(
    HttpApiEndpoint.post("clearDraft", "/git-message/draft/clear", {
      success: CommitDraft,
    })
  ) {}
