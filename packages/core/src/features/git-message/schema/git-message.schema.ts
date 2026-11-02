import * as Schema from "effect/Schema";

export const CommitAgent = Schema.Literals([
  "claude",
  "opencode",
  "codex",
  "cursor",
]);
export type CommitAgent = typeof CommitAgent.Type;
/**
 * One repository of a workspace a draft reads from: where it is, what it is
 * called in the prompt, and which of its files the commit takes (none named
 * is every change).
 */
export const DraftRepository = Schema.Struct({
  path: Schema.String,
  name: Schema.String,
  paths: Schema.Array(Schema.String),
});
export type DraftRepository = typeof DraftRepository.Type;

/**
 * A draft of the request's repository's `paths` — or, where one commit spans
 * a workspace of several, of each named repository's own.
 */
export const GenerateBody = Schema.Struct({
  paths: Schema.optionalKey(Schema.Array(Schema.String)),
  agent: Schema.optionalKey(CommitAgent),
  repositories: Schema.optionalKey(Schema.Array(DraftRepository)),
});
export type GenerateBody = typeof GenerateBody.Type;

export const DraftStatus = Schema.Literals([
  "idle",
  "running",
  "ready",
  "error",
]);
export type DraftStatus = typeof DraftStatus.Type;

/**
 * A drafting run and whatever it has produced so far. The agent CLI outlives
 * the request that asked for it, so this — not the response to that request —
 * is what a client reads its message off, however many reloads later.
 */
export const CommitDraft = Schema.Struct({
  status: DraftStatus,
  message: Schema.NullOr(Schema.String),
  error: Schema.NullOr(Schema.String),
  agent: Schema.NullOr(CommitAgent),
  paths: Schema.Array(Schema.String),
});
export type CommitDraft = typeof CommitDraft.Type;
