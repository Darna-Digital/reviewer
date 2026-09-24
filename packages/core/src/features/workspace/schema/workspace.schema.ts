import * as Schema from "effect/Schema";

/**
 * A git repository the machine holds, as the repository index lists it: the
 * folder it lives in, the branch it is checked out on, and when it was last
 * opened here — the opener's recents are the entries that carry a date.
 */
export const RepoEntry = Schema.Struct({
  /** The folder's own name — `web-app` for `/a/b/web-app`. */
  name: Schema.String,
  path: Schema.String,
  /** The checked-out branch, or null when HEAD is detached/unreadable. */
  branch: Schema.NullOr(Schema.String),
  /** ISO timestamp of the last open, or null for one never opened here. */
  lastOpened: Schema.NullOr(Schema.String),
});
export type RepoEntry = typeof RepoEntry.Type;

/**
 * Every repository found on the machine, and whether the walk that finds them
 * is still under way — a fresh index fills in as the scan reaches folders.
 */
export const RepoIndex = Schema.Struct({
  repos: Schema.Array(RepoEntry),
  scanning: Schema.Boolean,
  /** When the last complete scan finished, or null before the first has. */
  scannedAt: Schema.NullOr(Schema.String),
});
export type RepoIndex = typeof RepoIndex.Type;

export const WorkspaceInfo = Schema.Struct({
  /** The open repository, or null when nothing is open. */
  project: Schema.NullOr(Schema.String),
  /** The branch it is on, or null when HEAD is detached or nothing is open. */
  branch: Schema.NullOr(Schema.String),
  /** Recently opened repositories, most-recent first. */
  recents: Schema.Array(Schema.String),
  home: Schema.String,
});
export type WorkspaceInfo = typeof WorkspaceInfo.Type;
export const BrowseEntry = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
  isGitRepo: Schema.Boolean,
});
export type BrowseEntry = typeof BrowseEntry.Type;
export const BrowsePayload = Schema.Struct({
  path: Schema.String,
  parent: Schema.NullOr(Schema.String),
  isGitRepo: Schema.Boolean,
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
export const WriteFile = Schema.Struct({
  path: Schema.String,
  contents: Schema.String,
});
export type WriteFile = typeof WriteFile.Type;
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
