import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { GitError, NoRepoSelected } from "../errors.ts"

export type GitFailure = GitError | NoRepoSelected
export interface GitExecShape {
  readonly run: (
    ...args: ReadonlyArray<string>
  ) => Effect.Effect<string, GitFailure>
  readonly runVerbose: (
    ...args: ReadonlyArray<string>
  ) => Effect.Effect<string, GitFailure>
  readonly runTolerant: (
    ...args: ReadonlyArray<string>
  ) => Effect.Effect<string, GitFailure>
  readonly lines: (
    ...args: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<string>, GitFailure>
}
export class GitExec extends Context.Service<GitExec, GitExecShape>()(
  "GitExec"
) {}
