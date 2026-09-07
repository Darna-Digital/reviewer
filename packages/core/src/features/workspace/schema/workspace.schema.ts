import * as Schema from "effect/Schema";

/**
 * A git root inside the open project. A project is a folder — it may be a
 * repository itself (one entry, named after the folder) or a parent holding
 * several side by side (`backend`, `frontend`), which is what the IDEs call a
 * multi-root project.
 */
export const RepoEntry = Schema.Struct({
  /** Project-relative path, so nested roots read as `apps/web`. */
  name: Schema.String,
  path: Schema.String,
  /** The checked-out branch, or null when HEAD is detached/unreadable. */
  branch: Schema.NullOr(Schema.String),
});
export type RepoEntry = typeof RepoEntry.Type;
export const WorkspaceInfo = Schema.Struct({
  /** The open project folder, or null when nothing is open. */
  project: Schema.NullOr(Schema.String),
  /** Every git root the project holds, ordered by project-relative name. */
  repos: Schema.Array(RepoEntry),
  /** Where git actions run — one of the project's roots; null when it holds
   * none. */
  current: Schema.NullOr(Schema.String),
  /** Recently opened projects, most-recent first. */
  recents: Schema.Array(Schema.String),
  home: Schema.String,
});
export type WorkspaceInfo = typeof WorkspaceInfo.Type;
export const BrowseEntry = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
  isGitRepo: Schema.Boolean,
  /** Git roots found inside this folder — what makes it openable as a project. */
  repoCount: Schema.Number,
});
export type BrowseEntry = typeof BrowseEntry.Type;
export const BrowsePayload = Schema.Struct({
  path: Schema.String,
  parent: Schema.NullOr(Schema.String),
  isGitRepo: Schema.Boolean,
  repoCount: Schema.Number,
  entries: Schema.Array(BrowseEntry),
});
export type BrowsePayload = typeof BrowsePayload.Type;
export const FileContent = Schema.Struct({
  name: Schema.String,
  /** Empty for a binary file — there is no text to hand a viewer. */
  contents: Schema.String,
  binary: Schema.Boolean,
  sizeBytes: Schema.Number,
});
export type FileContent = typeof FileContent.Type;
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
};

/** The media type a path renders as, `application/octet-stream` when unknown. */
export const mediaTypeFor = (path: string): string =>
  MEDIA_TYPES[path.split(".").at(-1)?.toLowerCase() ?? ""] ??
  "application/octet-stream";

/** A file read as bytes — for the surfaces that render rather than edit it. */
export const FileBytes = Schema.Struct({
  name: Schema.String,
  mediaType: Schema.String,
  base64: Schema.String,
});
export type FileBytes = typeof FileBytes.Type;
export const SetWorkspace = Schema.Struct({
  path: Schema.String,
});
export type SetWorkspace = typeof SetWorkspace.Type;
/** Which of the open project's git roots the git views should follow. */
export const SelectRepo = Schema.Struct({
  path: Schema.String,
});
export type SelectRepo = typeof SelectRepo.Type;
export const WriteFile = Schema.Struct({
  path: Schema.String,
  contents: Schema.String,
});
export type WriteFile = typeof WriteFile.Type;
export const RenameFile = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
});
export type RenameFile = typeof RenameFile.Type;
/** A file dropped in from outside the project — bytes, so binaries survive. */
export const UploadFile = Schema.Struct({
  path: Schema.String,
  base64: Schema.String,
});
export type UploadFile = typeof UploadFile.Type;
/**
 * Where a deleted path went. Deleting moves it into the project's own trash
 * rather than unlinking it, so undoing a delete is an ordinary rename back.
 */
export const Trashed = Schema.Struct({
  path: Schema.String,
});
export type Trashed = typeof Trashed.Type;
export const CopyPath = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
});
export type CopyPath = typeof CopyPath.Type;
export const PathKind = Schema.Literals(["file", "directory"]);
export type PathKind = typeof PathKind.Type;
export const CreatePath = Schema.Struct({
  path: Schema.String,
  kind: PathKind,
});
export type CreatePath = typeof CreatePath.Type;
export const BrowseQuery = Schema.Struct({
  path: Schema.optionalKey(Schema.String),
});
export type BrowseQuery = typeof BrowseQuery.Type;
export const PathQuery = Schema.Struct({
  path: Schema.String,
});
export type PathQuery = typeof PathQuery.Type;
/** Show a path where the operating system keeps it — Finder, Explorer, files. */
export const RevealPath = Schema.Struct({
  path: Schema.String,
});
export type RevealPath = typeof RevealPath.Type;
