import * as Schema from "effect/Schema"

export const RepoEntry = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
})
export type RepoEntry = typeof RepoEntry.Type
export const WorkspaceInfo = Schema.Struct({
  current: Schema.NullOr(Schema.String),
  recents: Schema.Array(Schema.String),
  home: Schema.String,
  isGitRepo: Schema.Boolean,
  childRepos: Schema.Array(RepoEntry),
})
export type WorkspaceInfo = typeof WorkspaceInfo.Type
export const BrowseEntry = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
  isGitRepo: Schema.Boolean,
})
export type BrowseEntry = typeof BrowseEntry.Type
export const BrowsePayload = Schema.Struct({
  path: Schema.String,
  parent: Schema.NullOr(Schema.String),
  isGitRepo: Schema.Boolean,
  entries: Schema.Array(BrowseEntry),
})
export type BrowsePayload = typeof BrowsePayload.Type
export const FileContent = Schema.Struct({
  name: Schema.String,
  contents: Schema.String,
})
export type FileContent = typeof FileContent.Type
export const Ok = Schema.Struct({ ok: Schema.Boolean })
export type Ok = typeof Ok.Type
export const SetWorkspace = Schema.Struct({
  path: Schema.String,
})
export type SetWorkspace = typeof SetWorkspace.Type
export const WriteFile = Schema.Struct({
  path: Schema.String,
  contents: Schema.String,
})
export type WriteFile = typeof WriteFile.Type
export const RenameFile = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
})
export type RenameFile = typeof RenameFile.Type
export const BrowseQuery = Schema.Struct({
  path: Schema.optionalKey(Schema.String),
})
export type BrowseQuery = typeof BrowseQuery.Type
export const PathQuery = Schema.Struct({
  path: Schema.String,
})
export type PathQuery = typeof PathQuery.Type
