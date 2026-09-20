/**
 * Where a drafted commit message's changes come from: the open repository.
 * Asking for the changes rather than running git itself keeps the service
 * testable without one.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { GitExec, type GitFailure } from "../../../ports/git-exec.ts";
import {
  collectDraftChanges,
  type DraftChanges,
} from "../functions/git-message.functions.ts";

export interface GitMessageChangesShape {
  readonly collect: (
    paths: ReadonlyArray<string>
  ) => Effect.Effect<DraftChanges, GitFailure>;
}

export class GitMessageChanges extends Context.Service<
  GitMessageChanges,
  GitMessageChangesShape
>()("GitMessageChanges") {}

export const makeRepoChanges = Effect.map(GitExec, (git) =>
  GitMessageChanges.of({
    collect: (paths) => collectDraftChanges(git, paths),
  })
);
