/**
 * HTTP endpoints for AI commit-message drafting. Starting a draft answers with
 * the run rather than the message — the CLI is still going when the response
 * is written — and the message is read off the draft once it lands.
 */
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import * as Schema from "effect/Schema";
import { CommitDraft, GenerateBody } from "@byconvo/core/git-message";

/** Which draft slot a read or a clear is about — a worktree's, or this checkout's. */
const DraftScope = Schema.Struct({
  worktree: Schema.optional(Schema.String),
});

export class GitMessageApi extends HttpApiGroup.make("gitMessage")
  .add(
    HttpApiEndpoint.post("generate", "/git-message/generate", {
      payload: GenerateBody,
      success: CommitDraft,
    })
  )
  .add(
    HttpApiEndpoint.get("draft", "/git-message/draft", {
      query: DraftScope,
      success: CommitDraft,
    })
  )
  .add(
    HttpApiEndpoint.post("clearDraft", "/git-message/draft/clear", {
      payload: DraftScope,
      success: CommitDraft,
    })
  ) {}
