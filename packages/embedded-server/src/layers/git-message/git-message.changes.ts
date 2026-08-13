/**
 * The changes a commit message is drafted from, read the way the commit that
 * follows will be made: the selected repository for a project holding one root,
 * and every root the chosen paths reach for a project holding several.
 *
 * The paths arrive named from the project (`backend/src/a.ts`), because that is
 * what the commit view shows and what `/project/commit` takes. Running those
 * against a single root would match nothing — which is why a draft across roots
 * has to be split, collected per root, and named back from the project before
 * the model ever sees it.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { ChildProcessSpawner } from "effect/unstable/process";
import {
  collectDraftChanges,
  GitMessageChanges,
  hasChanges,
  type DraftChanges,
  type GitMessageChangesShape,
} from "@byconvo/core/git-message";
import { GitExec } from "@byconvo/core/ports/git-exec";
import {
  groupPathsByRepo,
  prefixDiffPaths,
  projectPath,
} from "@byconvo/core/project";
import { makeAt } from "../git/git-exec.ts";
import { scanRepos } from "../workspace/repo-scan.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import type { RepoEntry } from "@byconvo/core/workspace";

/** As many roots at once as the project's other reads use. */
const CONCURRENCY = 8;

export const makeWorkspaceChanges = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const ctx = yield* WorkspaceContext;
  const selected = yield* GitExec;

  const gitAt = (root: string) =>
    makeAt(root).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
    );

  const roots = Effect.gen(function* () {
    const project = yield* ctx.project;
    return project === null
      ? ([] as ReadonlyArray<RepoEntry>)
      : yield* scanRepos(fs, project);
  });

  /** One root's changes, named from the project. Null when it cannot be read —
   * a half-cloned root must not sink the draft the others can support. */
  const collectIn = (repo: RepoEntry, paths: ReadonlyArray<string>) =>
    Effect.flatMap(gitAt(repo.path), (git) =>
      collectDraftChanges(git, paths)
    ).pipe(
      Effect.map(
        (changes): DraftChanges => ({
          diff: prefixDiffPaths(changes.diff, repo.name),
          untracked: changes.untracked.map((path) => projectPath(repo, path)),
          branch: changes.branch,
        })
      ),
      Effect.catch(() => Effect.succeed(null))
    );

  const collect: GitMessageChangesShape["collect"] = (paths) =>
    Effect.gen(function* () {
      const repos = yield* roots;
      if (repos.length < 2) return yield* collectDraftChanges(selected, paths);
      // No paths means "everything", which spans every root; a selection is
      // split into the roots that own it, and a path no root claims is dropped
      // exactly as the commit drops it.
      const groups =
        paths.length === 0
          ? repos.map((repo) => ({ repo, paths: [] as ReadonlyArray<string> }))
          : groupPathsByRepo(repos, paths);
      const collected = yield* Effect.forEach(
        groups,
        (group) => collectIn(group.repo, group.paths),
        { concurrency: CONCURRENCY }
      );
      const contributing = collected
        .filter((changes) => changes !== null)
        .filter(hasChanges);
      return {
        diff: contributing
          .map((changes) => changes.diff)
          .filter((diff) => diff.trim().length > 0)
          .join("\n"),
        untracked: contributing.flatMap((changes) => changes.untracked),
        // The slug belongs to the branch the work was done on, so it comes from
        // the first root that actually changed rather than whichever root the
        // views happen to be pointed at.
        branch: contributing[0]?.branch ?? "",
      };
    });

  return GitMessageChanges.of({ collect });
});
