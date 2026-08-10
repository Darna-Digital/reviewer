import * as Schema from "effect/Schema";

export class InvalidRepo extends Schema.TaggedErrorClass<InvalidRepo>()(
  "InvalidRepo",
  { path: Schema.String, reason: Schema.String },
  { httpApiStatus: 400 }
) {
  override get message(): string {
    return `${this.path} is not a git repository: ${this.reason}`;
  }
}

export class PathExists extends Schema.TaggedErrorClass<PathExists>()(
  "PathExists",
  { path: Schema.String },
  { httpApiStatus: 409 }
) {
  override get message(): string {
    return `${this.path} already exists`;
  }
}
