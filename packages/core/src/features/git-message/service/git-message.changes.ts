/**
 * Where a drafted commit message's changes come from. The obvious answer is
 * the selected repository, which is what this module provides; a project
 * holding several roots has to read every root the chosen paths reach, and
 * wires its own collector in instead. Asking for the changes rather than
 * running git itself is what lets the service serve both.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { GitExec, type GitFailure } from "../../../ports/git-exec.ts";
import {
  collectDraftChanges,
  type DraftChanges,
} from "../functions/git-message.functions.ts";

export interface GitMessageChangesShape {
  /**
   * `at` names a working tree other than the selected one — a worktree being
   * reviewed. Without it a draft would summarise whatever is uncommitted in the
   * checkout you are standing in, which is a different change entirely.
   */
  readonly collect: (
    paths: ReadonlyArray<string>,
    at?: string | null
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
