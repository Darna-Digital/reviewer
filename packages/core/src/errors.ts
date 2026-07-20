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
export class ClaudeError extends Schema.TaggedErrorClass<ClaudeError>()(
  "ClaudeError",
  { reason: Schema.String },
  { httpApiStatus: 502 }
) {
  override get message(): string {
    return this.reason
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
export class InvalidRepo extends Schema.TaggedErrorClass<InvalidRepo>()(
  "InvalidRepo",
  { path: Schema.String, reason: Schema.String },
  { httpApiStatus: 400 }
) {
  override get message(): string {
    return `${this.path} is not a git repository: ${this.reason}`
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
export class GitHubError extends Schema.TaggedErrorClass<GitHubError>()(
  "GitHubError",
  { reason: Schema.String },
  { httpApiStatus: 502 }
) {
  override get message(): string {
    return this.reason
  }
}
export class ChatBusy extends Schema.TaggedErrorClass<ChatBusy>()(
  "ChatBusy",
  { chatId: Schema.String },
  { httpApiStatus: 409 }
) {
  override get message(): string {
    return `chat ${this.chatId} is already running a turn — stop it first`
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
