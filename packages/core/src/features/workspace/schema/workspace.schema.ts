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

/**
 * One repository open in the workspace — a root, as a JetBrains project calls
 * each of the version-controlled folders it holds side by side.
 */
export const WorkspaceRoot = Schema.Struct({
  path: Schema.String,
  /** The folder's own name, what the root reads as in a tree or a picker. */
  name: Schema.String,
  /** The branch it is on, or null when HEAD is detached or unreadable. */
  branch: Schema.NullOr(Schema.String),
});
export type WorkspaceRoot = typeof WorkspaceRoot.Type;

/**
 * A workspace kept to come back to: a name over an ordered set of
 * repositories, opened together as one environment.
 */
export const SavedWorkspace = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  /** The repositories it holds, in the order the tree lists them. */
  roots: Schema.Array(Schema.String),
  createdAt: Schema.String,
  /** ISO timestamp of the last open, or null for one never opened. */
  openedAt: Schema.NullOr(Schema.String),
});
export type SavedWorkspace = typeof SavedWorkspace.Type;

export const SavedWorkspaces = Schema.Array(SavedWorkspace);
export type SavedWorkspaces = typeof SavedWorkspaces.Type;

/** Which saved workspace is open, when the open one is a saved one. */
export const OpenWorkspaceRef = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});
export type OpenWorkspaceRef = typeof OpenWorkspaceRef.Type;

export const WorkspaceInfo = Schema.Struct({
  /**
   * The repository a request that names none runs against — the root the
   * request named, or else the workspace's first — or null when nothing is
   * open. Clients that know the workspace address each root themselves.
   */
  project: Schema.NullOr(Schema.String),
  /** The branch it is on, or null when HEAD is detached or nothing is open. */
  branch: Schema.NullOr(Schema.String),
  /** Every repository open side by side, in the workspace's order. */
  roots: Schema.Array(WorkspaceRoot),
  /**
   * The saved workspace those roots are, or null for repositories opened
   * on their own — a single repository picked from the opener.
   */
  workspace: Schema.NullOr(OpenWorkspaceRef),
  /** Recently opened repositories, most-recent first. */
  recents: Schema.Array(Schema.String),
  home: Schema.String,
});
export type WorkspaceInfo = typeof WorkspaceInfo.Type;

export const CreateWorkspace = Schema.Struct({
  name: Schema.String,
  roots: Schema.Array(Schema.String),
});
export type CreateWorkspace = typeof CreateWorkspace.Type;

export const UpdateWorkspace = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  roots: Schema.optionalKey(Schema.Array(Schema.String)),
});
export type UpdateWorkspace = typeof UpdateWorkspace.Type;

/** The open workspace's repositories, replaced as a whole. */
export const SetRoots = Schema.Struct({
  roots: Schema.Array(Schema.String),
});
export type SetRoots = typeof SetRoots.Type;

export const WorkspaceIdParams = Schema.Struct({
  id: Schema.String,
});
export type WorkspaceIdParams = typeof WorkspaceIdParams.Type;
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
