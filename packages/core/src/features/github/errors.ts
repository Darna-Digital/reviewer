import * as Schema from "effect/Schema"

export class GitHubError extends Schema.TaggedErrorClass<GitHubError>()(
  "GitHubError",
  { reason: Schema.String },
  { httpApiStatus: 502 }
) {
  override get message(): string {
    return this.reason
  }
}
