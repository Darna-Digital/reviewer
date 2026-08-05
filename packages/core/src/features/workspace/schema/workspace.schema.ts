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
const MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  ico: "image/x-icon",
  svg: "image/svg+xml",
}

/** The media type a path renders as, `application/octet-stream` when unknown. */
export const mediaTypeFor = (path: string): string =>
  MEDIA_TYPES[path.split(".").at(-1)?.toLowerCase() ?? ""] ??
  "application/octet-stream"

/** A file read as bytes — for the surfaces that render rather than edit it. */
export const FileBytes = Schema.Struct({
  name: Schema.String,
  mediaType: Schema.String,
  base64: Schema.String,
})
export type FileBytes = typeof FileBytes.Type
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
