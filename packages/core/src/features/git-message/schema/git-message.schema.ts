import * as Schema from "effect/Schema"

export const GeneratedMessage = Schema.Struct({ message: Schema.String })
export type GeneratedMessage = typeof GeneratedMessage.Type
export const CommitAgent = Schema.Literals(["claude", "opencode", "codex"])
export type CommitAgent = typeof CommitAgent.Type
export const GenerateBody = Schema.Struct({
  paths: Schema.optionalKey(Schema.Array(Schema.String)),
  agent: Schema.optionalKey(CommitAgent),
})
export type GenerateBody = typeof GenerateBody.Type
