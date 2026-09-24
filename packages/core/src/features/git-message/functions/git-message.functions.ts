/**
 * What a repository has uncommitted, in the shape a drafted commit message is
 * written from: the diff against HEAD, the untracked files that diff cannot
 * show, and the branch whose name may carry an issue slug.
 */
import * as Effect from "effect/Effect";
import type { GitExecShape, GitFailure } from "../../../ports/git-exec.ts";

export interface DraftChanges {
  readonly diff: string;
  readonly untracked: ReadonlyArray<string>;
  readonly branch: string;
}

export const collectDraftChanges = (
  git: GitExecShape,
  paths: ReadonlyArray<string>
): Effect.Effect<DraftChanges, GitFailure> =>
  Effect.gen(function* () {
    const pathspec = paths.length === 0 ? [] : ["--", ...paths];
    const diff = yield* git
      .run("diff", "HEAD", ...pathspec)
      .pipe(Effect.catchTag("GitError", () => Effect.succeed("")));
    const untracked = yield* git
      .lines("ls-files", "--others", "--exclude-standard", ...pathspec)
      .pipe(
        Effect.catchTag("GitError", () =>
          Effect.succeed([] as ReadonlyArray<string>)
        )
      );
    const branch = yield* git.run("rev-parse", "--abbrev-ref", "HEAD").pipe(
      Effect.map((name) => name.trim()),
      Effect.catchTag("GitError", () => Effect.succeed(""))
    );
    return { diff, untracked, branch };
  });

export const hasChanges = (changes: DraftChanges): boolean =>
  changes.diff.trim().length > 0 || changes.untracked.length > 0;
