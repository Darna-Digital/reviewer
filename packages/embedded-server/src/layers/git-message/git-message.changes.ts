/**
 * The changes a commit message is drafted from, read from the open repository
 * the way the commit that follows will be made.
 */
import * as Effect from "effect/Effect";
import {
  collectDraftChanges,
  GitMessageChanges,
  type GitMessageChangesShape,
} from "@reviewer/core/git-message";
import { GitExec } from "@reviewer/core/ports/git-exec";

export const makeWorkspaceChanges = Effect.gen(function* () {
  const git = yield* GitExec;
  const collect: GitMessageChangesShape["collect"] = (paths) =>
    collectDraftChanges(git, paths);
  return GitMessageChanges.of({ collect });
});
