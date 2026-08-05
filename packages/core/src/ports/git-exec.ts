import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { NoRepoSelected } from "../shared.ts";

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
    return `git ${this.args.join(" ")} failed (${this.exitCode}): ${this.stderr.trim()}`;
  }
}

export type GitFailure = GitError | NoRepoSelected;
export interface GitExecShape {
  readonly run: (
    ...args: ReadonlyArray<string>
  ) => Effect.Effect<string, GitFailure>;
  readonly runVerbose: (
    ...args: ReadonlyArray<string>
  ) => Effect.Effect<string, GitFailure>;
  readonly runTolerant: (
    ...args: ReadonlyArray<string>
  ) => Effect.Effect<string, GitFailure>;
  readonly lines: (
    ...args: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<string>, GitFailure>;
}
export class GitExec extends Context.Service<GitExec, GitExecShape>()(
  "GitExec"
) {}
