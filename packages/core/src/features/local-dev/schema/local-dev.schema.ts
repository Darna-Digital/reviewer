import * as Schema from "effect/Schema";

/**
 * What the open repository's dev-commands store holds. The repository a
 * command runs in is the store's own scope, so it is never written down — a
 * repository that is renamed or moved keeps its commands instead of pointing
 * at a path that no longer is. `cwd` is the folder inside it the command runs
 * from, relative to the root and empty for the root itself, so a monorepo's
 * packages can each have their own commands.
 */
export const DevCommand = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  command: Schema.String,
  cwd: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type DevCommand = typeof DevCommand.Type;

/**
 * A stored command as it was written, read back at today's shape: one written
 * before commands had a folder is the root's.
 */
export const decodeStoredDevCommand = (input: unknown): DevCommand =>
  Schema.decodeUnknownSync(DevCommand)({ cwd: "", ...(input as object) });
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
  cwd: Schema.optionalKey(Schema.String),
});
export type NewDevCommand = typeof NewDevCommand.Type;
export const UpdateDevCommand = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  command: Schema.optionalKey(Schema.String),
  cwd: Schema.optionalKey(Schema.String),
});

/**
 * A folder as `cwd` stores it: separators normalised, `.` and `..` segments
 * folded away, no leading or trailing slash — so `./packages/web/` and
 * `packages/web` are the same folder, and the path can never climb out of
 * the repository.
 */
export const normalizeDevCwd = (input: string): string => {
  const kept: string[] = [];
  for (const segment of input.trim().replaceAll("\\", "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") kept.pop();
    else kept.push(segment);
  }
  return kept.join("/");
};
export type UpdateDevCommand = typeof UpdateDevCommand.Type;
export const DevCommandIdParam = Schema.Struct({ id: Schema.String });
