import * as Schema from "effect/Schema";

export const CommitAgent = Schema.Literals([
  "claude",
  "opencode",
  "codex",
  "cursor",
]);
export type CommitAgent = typeof CommitAgent.Type;
export const GenerateBody = Schema.Struct({
  paths: Schema.optionalKey(Schema.Array(Schema.String)),
  agent: Schema.optionalKey(CommitAgent),
  /**
   * The worktree the change is in, by branch. Absent means the checkout you are
   * standing in — a draft has to read the same tree the commit will be made in.
   */
  worktree: Schema.optionalKey(Schema.String),
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
