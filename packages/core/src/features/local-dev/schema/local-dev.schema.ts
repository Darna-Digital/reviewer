import * as Schema from "effect/Schema";

export const DevCommand = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  command: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type DevCommand = typeof DevCommand.Type;
export const DevCommandStatus = Schema.Literals([
  "stopped",
  "running",
  "exited",
]);
export type DevCommandStatus = typeof DevCommandStatus.Type;
export const DevCommandView = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  command: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  status: DevCommandStatus,
  exitCode: Schema.NullOr(Schema.Number),
});
export type DevCommandView = typeof DevCommandView.Type;
export const NewDevCommand = Schema.Struct({
  name: Schema.String,
  command: Schema.String,
});
export type NewDevCommand = typeof NewDevCommand.Type;
export const UpdateDevCommand = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  command: Schema.optionalKey(Schema.String),
});
export type UpdateDevCommand = typeof UpdateDevCommand.Type;
export const DevCommandIdParam = Schema.Struct({ id: Schema.String });
