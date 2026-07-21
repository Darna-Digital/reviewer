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
