import * as Schema from "effect/Schema"

export class GitError extends Schema.TaggedErrorClass<GitError>()(
  "GitError",
  {
    args: Schema.Array(Schema.String),
    exitCode: Schema.Number,
    stderr: Schema.String,
  },
  { httpApiStatus: 500 }
) {
  override get message(): string {
    return `git ${this.args.join(" ")} failed (${this.exitCode}): ${this.stderr.trim()}`
  }
}
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
export class TerminalError extends Schema.TaggedErrorClass<TerminalError>()(
  "TerminalError",
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
