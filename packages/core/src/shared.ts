import * as Schema from "effect/Schema"

export const Ok = Schema.Struct({ ok: Schema.Boolean })
export type Ok = typeof Ok.Type

export const DiffText = Schema.String
export type DiffText = typeof DiffText.Type

export class NoRepoSelected extends Schema.TaggedErrorClass<NoRepoSelected>()(
  "NoRepoSelected",
  {},
  { httpApiStatus: 409 }
) {
  override get message(): string {
    return "no repository selected — pick one with the repository picker"
  }
}

export class StorageError extends Schema.TaggedErrorClass<StorageError>()(
  "StorageError",
  { reason: Schema.String },
  { httpApiStatus: 500 }
) {
  override get message(): string {
    return this.reason
  }
}

export class NotFound extends Schema.TaggedErrorClass<NotFound>()(
  "NotFound",
  { reason: Schema.String },
  { httpApiStatus: 404 }
) {
  override get message(): string {
    return this.reason
  }
}

/**
 * A write the caller could retry differently — a project key that is already
 * taken, a label name repeated inside one project. Distinct from StorageError
 * so the UI can surface the reason next to the field instead of as a crash.
 */
export class Conflict extends Schema.TaggedErrorClass<Conflict>()(
  "Conflict",
  { reason: Schema.String },
  { httpApiStatus: 409 }
) {
  override get message(): string {
    return this.reason
  }
}

/**
 * The caller is signed in but not allowed to do this — editing someone else's
 * comment, or an org setting only the owner may touch. Distinct from a missing
 * session, which never reaches a service.
 */
export class Forbidden extends Schema.TaggedErrorClass<Forbidden>()(
  "Forbidden",
  { reason: Schema.String },
  { httpApiStatus: 403 }
) {
  override get message(): string {
    return this.reason
  }
}

/** A rejected payload — a blank title, a task parented to itself. */
export class InvalidInput extends Schema.TaggedErrorClass<InvalidInput>()(
  "InvalidInput",
  { reason: Schema.String },
  { httpApiStatus: 422 }
) {
  override get message(): string {
    return this.reason
  }
}
