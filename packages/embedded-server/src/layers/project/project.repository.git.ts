/**
 * The project's git state, read one root at a time and returned as one answer.
 *
 * Every query here is the `repo` feature's own query run against each root the
 * project holds: the repository is rebuilt per root with a GitExec pinned to
 * it, so there is exactly one implementation of "what does git say" and this
 * layer only decides where to point it and how to put the answers together.
 *
 * Roots are read concurrently, and a root that fails is named in `failed`
 * rather than failing the read — a half-cloned repository in the folder must
 * not blank the commit view for the ones that work.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { ChildProcessSpawner } from "effect/unstable/process";
import {
  groupPathsByRepo,
  mergeCommits,
  mergeMatches,
  prefixDiffPaths,
  projectPath,
  splitProjectPath,
} from "@byconvo/core/project";
import { GitExec } from "@byconvo/core/ports/git-exec";
import { makeGitRepoRepository } from "../repo/repo.repository.git.ts";
import { makeAt } from "../git/git-exec.ts";
import { scanRepos } from "../workspace/repo-scan.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import type { RepoRepo } from "@byconvo/core/repo";
import type {
  ProjectRepo,
  RepoBranches,
  RepoChanges,
  RepoCommitResult,
  RepoFailure,
} from "@byconvo/core/project";
import type { RepoEntry } from "@byconvo/core/workspace";

/** How many roots are read at once — enough to hide latency, bounded so a
 * folder of thirty repositories does not fork thirty gits at a time. */
const CONCURRENCY = 8;

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const makeGitProjectRepository = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const ctx = yield* WorkspaceContext;

  /** The `repo` feature's queries, pointed at one of the project's roots. */
  const repoAt = (root: string): Effect.Effect<RepoRepo> =>
    makeAt(root).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      Effect.flatMap((git) =>
        makeGitRepoRepository.pipe(
          Effect.provideService(GitExec, git),
          Effect.provideService(FileSystem.FileSystem, fs)
        )
      )
    );

  /** The project's roots, freshly scanned so a new clone shows up unprompted. */
  const roots = Effect.flatMap(ctx.requireProject, (project) =>
    scanRepos(fs, project)
  );

  /**
   * Run `read` against every root, splitting what came back from what could
   * not be read. Order follows the project's roots, not completion order, so
   * the views stay put between reads.
   */
  const acrossRoots = <A>(
    read: (repo: RepoEntry, git: RepoRepo) => Effect.Effect<A, unknown>
  ) =>
    Effect.gen(function* () {
      const repos = yield* roots;
      const results = yield* Effect.forEach(
        repos,
        (repo) =>
          Effect.flatMap(repoAt(repo.path), (git) => read(repo, git)).pipe(
            Effect.map((value) => ({ repo, value, failure: null })),
            Effect.catch((error) =>
              Effect.succeed({
                repo,
                value: null,
                failure: reasonOf(error),
              })
            )
          ),
        { concurrency: CONCURRENCY }
      );
      const ok: Array<{ repo: RepoEntry; value: A }> = [];
      const failed: Array<RepoFailure> = [];
      for (const result of results) {
        if (result.failure !== null) {
          failed.push({ repo: result.repo, reason: result.failure });
        } else if (result.value !== null) {
          ok.push({ repo: result.repo, value: result.value });
        }
      }
      return { ok, failed };
    });

  const changes: ProjectRepo["changes"] = Effect.map(
    acrossRoots((_repo, git) =>
      Effect.all({ files: git.files, status: git.status })
    ),
    ({ failed, ok }) => ({
      repos: ok.map(
        ({ repo, value }): RepoChanges => ({
          repo,
          status: value.status,
          files: value.files.gitStatus,
        })
      ),
      failed,
    })
  );

  const files: ProjectRepo["files"] = Effect.map(
    acrossRoots((_repo, git) => git.files),
    ({ failed, ok }) => ({
      // Naming every path from the project root is what makes the tree nest
      // the roots as folders: no grouping logic, just paths that already say
      // where they live.
      paths: ok.flatMap(({ repo, value }) =>
        value.paths.map((path) => projectPath(repo, path))
      ),
      gitStatus: ok.flatMap(({ repo, value }) =>
        value.gitStatus.map((entry) => ({
          ...entry,
          path: projectPath(repo, entry.path),
        }))
      ),
      failed,
    })
  );

  const worktreeDiff: ProjectRepo["worktreeDiff"] = Effect.map(
    acrossRoots((repo, git) =>
      Effect.map(git.worktreeDiff, (diff) => prefixDiffPaths(diff, repo.name))
    ),
    ({ ok }) =>
      ok
        .map(({ value }) => value)
        .filter((diff) => diff.trim().length > 0)
        .join("\n")
  );

  const branches: ProjectRepo["branches"] = Effect.map(
    acrossRoots((_repo, git) =>
      Effect.all({ local: git.branches, remote: git.remoteBranches })
    ),
    ({ failed, ok }) => ({
      repos: ok.map(
        ({ repo, value }): RepoBranches => ({
          repo,
          branches: value.local,
          remoteBranches: value.remote,
        })
      ),
      failed,
    })
  );

  const log: ProjectRepo["log"] = (query) =>
    Effect.gen(function* () {
      // A path filter is named from the project (`backend/src/a.ts`), so only
      // the root that owns it can answer, and it has to be asked in its own
      // terms. A path no root claims is owned by none of them, and has no
      // history — which is what git would say about it too.
      const owner =
        query.path === null ? null : splitProjectPath(yield* roots, query.path);
      const answers = (repo: RepoEntry) =>
        query.path === null || owner?.repo.path === repo.path;
      const { failed, ok } = yield* acrossRoots((repo, git) =>
        answers(repo)
          ? // Each root is asked for a whole page: any of them could supply the
            // whole merged page, so asking for a share of it would cut a busy
            // root short. Skipping is applied after the merge for the same
            // reason.
            git.log({
              ...query,
              path: owner?.path ?? query.path,
              limit: query.skip + query.limit,
              skip: 0,
            })
          : Effect.succeed([])
      );
      return {
        commits: mergeCommits(
          ok.map(({ repo, value }) => ({ repo, commits: value }))
        ).slice(query.skip, query.skip + query.limit),
        failed,
      };
    });

  const search: ProjectRepo["search"] = (query) =>
    Effect.map(
      // A whole page per root, for the same reason the log asks for one: the
      // matches may all come from a single root, and a share each would cut it
      // short. The merge is what applies the limit.
      acrossRoots((_repo, git) => git.search(query)),
      ({ failed, ok }) => ({
        ...mergeMatches(
          ok.map(({ repo, value }) => ({ repo, matches: value })),
          query.limit
        ),
        failed,
      })
    );

  const commit: ProjectRepo["commit"] = (message, paths) =>
    Effect.gen(function* () {
      const repos = yield* roots;
      const groups = groupPathsByRepo(repos, paths);
      // Sequential, not concurrent: a person reading the outcome wants the
      // roots reported in project order, and committing is cheap enough that
      // there is nothing to win by racing them.
      return {
        results: yield* Effect.forEach(groups, (group) =>
          Effect.flatMap(repoAt(group.repo.path), (git) =>
            git.commit(message, group.paths)
          ).pipe(
            Effect.map(
              (sha): RepoCommitResult => ({
                repo: group.repo,
                sha,
                reason: null,
              })
            ),
            Effect.catch((error) =>
              Effect.succeed({
                repo: group.repo,
                sha: null,
                reason: reasonOf(error),
              } satisfies RepoCommitResult)
            )
          )
        ),
      };
    });

  // Discarding is the commit's mirror image: the same split into the roots that
  // own the paths, so a selection spanning `backend` and `frontend` reverts in
  // both. Failures propagate — a discard that quietly did nothing is worse than
  // one that says it could not.
  const discard: ProjectRepo["discard"] = (paths) =>
    Effect.gen(function* () {
      const groups = groupPathsByRepo(yield* roots, paths);
      yield* Effect.forEach(
        groups,
        (group) =>
          Effect.flatMap(repoAt(group.repo.path), (git) =>
            git.discard(group.paths)
          ),
        { discard: true }
      );
    });

  const discardHunk: ProjectRepo["discardHunk"] = (path, hunkIndex) =>
    Effect.gen(function* () {
      const owner = splitProjectPath(yield* roots, path);
      // A path no root claims has no diff to revert a hunk of, which is what
      // git would say about it too.
      if (owner === null) return;
      const git = yield* repoAt(owner.repo.path);
      yield* git.discardHunk(owner.path, hunkIndex);
    });

  return {
    changes,
    files,
    worktreeDiff,
    branches,
    log,
    search,
    commit,
    discard,
    discardHunk,
  } satisfies ProjectRepo;
});
