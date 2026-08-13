import * as Schema from "effect/Schema";

/**
 * What one root's dev-commands file holds. The repository a command runs in is
 * the file's own location, so it is never written down — a root that is renamed
 * or moved keeps its commands instead of pointing at a path that no longer is.
 */
export const DevCommandDefinition = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  command: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type DevCommandDefinition = typeof DevCommandDefinition.Type;

/** A definition, told where it came from — one of the project's git roots. */
export const DevCommand = Schema.Struct({
  ...DevCommandDefinition.fields,
  /** Project-relative name of the root it runs in, e.g. `apps/web`. */
  repo: Schema.String,
  repoPath: Schema.String,
});
export type DevCommand = typeof DevCommand.Type;
export const DevCommandStatus = Schema.Literals([
  "stopped",
  "running",
  "exited",
]);
export type DevCommandStatus = typeof DevCommandStatus.Type;
export const DevCommandView = Schema.Struct({
  ...DevCommand.fields,
  status: DevCommandStatus,
  exitCode: Schema.NullOr(Schema.Number),
});
export type DevCommandView = typeof DevCommandView.Type;
export const NewDevCommand = Schema.Struct({
  name: Schema.String,
  command: Schema.String,
  /** Which of the project's roots it belongs to. */
  repoPath: Schema.String,
});
export type NewDevCommand = typeof NewDevCommand.Type;
export const UpdateDevCommand = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  command: Schema.optionalKey(Schema.String),
  /** Given and different, the command moves to that root. */
  repoPath: Schema.optionalKey(Schema.String),
});
export type UpdateDevCommand = typeof UpdateDevCommand.Type;
export const DevCommandIdParam = Schema.Struct({ id: Schema.String });

/** Which roots a run-all/stop-all covers — one of them, or all of them. */
export const DevRepoScope = Schema.Struct({
  repoPath: Schema.optionalKey(Schema.String),
});
export type DevRepoScope = typeof DevRepoScope.Type;
