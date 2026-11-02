/**
 * The changes a commit message is drafted from, read the way the commit that
 * follows will be made: in the request's repository, or across a workspace's
 * — each one's git run in that repository by naming it as the request's
 * (see `RequestedRepo`), which the git executor resolves its root through.
 */
import * as Effect from "effect/Effect";
import {
  collectDraftChanges,
  GitMessageChanges,
  type GitMessageChangesShape,
} from "@reviewer/core/git-message";
import { GitExec } from "@reviewer/core/ports/git-exec";
import { RequestedRepo } from "../workspace/requested-repo.ts";

export const makeWorkspaceChanges = Effect.gen(function* () {
  const git = yield* GitExec;
  const collect: GitMessageChangesShape["collect"] = (paths) =>
    collectDraftChanges(git, paths);
  const collectAcross: GitMessageChangesShape["collectAcross"] = (
    repositories
  ) =>
    Effect.forEach(repositories, (repository) =>
      collectDraftChanges(git, repository.paths).pipe(
        Effect.provideService(RequestedRepo, repository.path),
        Effect.map((changes) => ({ name: repository.name, changes }))
      )
    );
  return GitMessageChanges.of({ collect, collectAcross });
});
