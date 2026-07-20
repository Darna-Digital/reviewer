/** git-message domain schemas — the AI-drafted commit message. */
import * as Schema from "effect/Schema"

/** An AI-generated commit message (from a local agent CLI). */
export const GeneratedMessage = Schema.Struct({ message: Schema.String })
export type GeneratedMessage = typeof GeneratedMessage.Type

/**
 * Which locally installed agent CLI drafts the message. Mirrors the threads
 * agent kinds minus "terminal" (there's no plain-shell way to write a message).
 */
export const CommitAgent = Schema.Literals(["claude", "opencode", "codex"])
export type CommitAgent = typeof CommitAgent.Type

/** Generate a commit message for the given changed paths (empty = all). */
export const GenerateBody = Schema.Struct({
  paths: Schema.optionalKey(Schema.Array(Schema.String)),
  agent: Schema.optionalKey(CommitAgent),
})
export type GenerateBody = typeof GenerateBody.Type
