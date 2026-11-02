import * as Schema from "effect/Schema";

export const Ok = Schema.Struct({ ok: Schema.Boolean });
export type Ok = typeof Ok.Type;

export const DiffText = Schema.String;
export type DiffText = typeof DiffText.Type;

/**
 * Nothing to run a repository-scoped request against: no repository is open,
 * or the one the request named (`repo`) is not among the workspace's roots.
 */
export class NoRepoSelected extends Schema.TaggedError<NoRepoSelected>()(
  "NoRepoSelected",
  { repo: Schema.optionalKey(Schema.String) },
  { httpApiStatus: 409 }
) {
  override get message(): string {
    return this.repo === undefined
      ? "no repository selected — pick one with the repository picker"
      : `${this.repo} is not open in this workspace`;
  }
}

// Catch-all for platform/filesystem failures (disk IO, git, etc.) that
// repositories map errors into; `reason` carries the underlying message
// since these come from many unrelated sources with no fixed wording.
export class StorageError extends Schema.TaggedError<StorageError>()(
  "StorageError",
  { reason: Schema.String },
  { httpApiStatus: 500 }
) {
  override get message(): string {
    return this.reason;
  }
}

export class NotFound extends Schema.TaggedError<NotFound>()(
  "NotFound",
  { reason: Schema.String },
  { httpApiStatus: 404 }
) {
  override get message(): string {
    return this.reason;
  }
}
