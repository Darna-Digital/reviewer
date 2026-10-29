/**
 * Where a drafted commit message's changes come from: the open repository,
 * or each of a workspace's. Asking for the changes rather than running git
 * itself keeps the service testable without one.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { GitExec, type GitFailure } from "../../../ports/git-exec.ts";
import {
  collectDraftChanges,
  type DraftChanges,
} from "../functions/git-message.functions.ts";
import type { DraftRepository } from "../schema/git-message.schema.ts";

/** A repository's changes, with the name the prompt calls it by. */
export interface RepositoryChanges {
  readonly name: string;
  readonly changes: DraftChanges;
}

export interface GitMessageChangesShape {
  readonly collect: (
    paths: ReadonlyArray<string>
  ) => Effect.Effect<DraftChanges, GitFailure>;
  /** Each repository's changes, read in that repository. */
  readonly collectAcross: (
    repositories: ReadonlyArray<DraftRepository>
  ) => Effect.Effect<ReadonlyArray<RepositoryChanges>, GitFailure>;
}

export class GitMessageChanges extends Context.Service<
  GitMessageChanges,
  GitMessageChangesShape
>()("GitMessageChanges") {}

export const makeRepoChanges = Effect.map(GitExec, (git) =>
  GitMessageChanges.of({
    collect: (paths) => collectDraftChanges(git, paths),
    collectAcross: (repositories) =>
      Effect.forEach(repositories, (repository) =>
        Effect.map(collectDraftChanges(git, repository.paths), (changes) => ({
          name: repository.name,
          changes,
        }))
      ),
  })
);
