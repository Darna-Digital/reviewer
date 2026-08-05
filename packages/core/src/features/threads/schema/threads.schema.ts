import * as Schema from "effect/Schema";

export const AgentKind = Schema.Literals([
  "terminal",
  "claude",
  "opencode",
  "codex",
  "cursor",
]);
export type AgentKind = typeof AgentKind.Type;
export const ThreadEntry = Schema.Struct({
  id: Schema.String,
  command: Schema.String,
  stdout: Schema.String,
  stderr: Schema.String,
  exitCode: Schema.Number,
  createdAt: Schema.String,
});
export type ThreadEntry = typeof ThreadEntry.Type;
export const Thread = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  agent: AgentKind,
  branch: Schema.String,
  taskKey: Schema.NullOr(Schema.String),
  initialPrompt: Schema.String,
  agentSessionId: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  entries: Schema.Array(ThreadEntry),
});
export type Thread = typeof Thread.Type;
export const ThreadSummary = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  agent: AgentKind,
  branch: Schema.String,
  taskKey: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  entryCount: Schema.Number,
  lastCommand: Schema.NullOr(Schema.String),
});
export type ThreadSummary = typeof ThreadSummary.Type;
export const NewThread = Schema.Struct({
  title: Schema.optionalKey(Schema.String),
  agent: Schema.optionalKey(AgentKind),
  branch: Schema.optionalKey(Schema.String),
  taskKey: Schema.optionalKey(Schema.String),
  initialPrompt: Schema.optionalKey(Schema.String),
});
export type NewThread = typeof NewThread.Type;
export const RenameThread = Schema.Struct({
  title: Schema.String,
  branch: Schema.optionalKey(Schema.String),
  taskKey: Schema.optionalKey(Schema.NullOr(Schema.String)),
});
export type RenameThread = typeof RenameThread.Type;
export const RunCommand = Schema.Struct({
  command: Schema.String,
});
export type RunCommand = typeof RunCommand.Type;
export const ThreadIdParam = Schema.Struct({ id: Schema.String });
