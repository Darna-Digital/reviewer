/**
 * Tasks — the worktrees of a repository, read and acted on as pull requests.
 *
 * Everything here is deliberately answerable from wherever the app happens to
 * be. Refs are shared across a repository's worktrees, so listing a task,
 * counting what it is ahead by and diffing it against its base are all ordinary
 * ref questions; only the merge itself has to touch a working tree, and only
 * when git refuses to move a branch somebody is standing on.
 *
 * That is what makes a task reviewable without going to it — the property the
 * whole surface is built on.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { ChildProcessSpawner } from "effect/unstable/process";
import { BranchTargetsService } from "@byconvo/core/branch-targets";
import { GitExec, type GitFailure } from "@byconvo/core/ports/git-exec";
import { RepoService } from "@byconvo/core/repo";
import type { GitStatusEntry, LocalTask } from "@byconvo/core/repo";
import { LocalDevService } from "@byconvo/core/local-dev";
import { makeAt } from "../git/git-exec.ts";
import { parseStatusLine } from "../repo/repo.repository.git.ts";
import { DevRuntime } from "../local-dev/local-dev.runtime.ts";
import { retireCommands } from "../local-dev/worktree-services.ts";
import { baseOf, mergeRoute, taskWorktrees } from "./task-routing.ts";

/** Why a merge did not happen, or null when it did. */
export interface MergeOutcome {
  readonly merged: boolean;
  readonly reason: string | null;
}

export interface LocalTasksServiceShape {
  readonly list: Effect.Effect<ReadonlyArray<LocalTask>, GitFailure>;
  /**
   * Everything the task has done, read in its own worktree: the merge base on
   * the old side, what is on disk there on the new one.
   *
   * Uncommitted work is *in* it, unlike the range a pull request is read as. An
   * agent that has written a change and not committed it has still done the
   * work, and a review that shows nothing until it commits is a review you
   * cannot use while the work is happening — which is most of the time.
   *
   * `base` names what to read against; null means the branch's own base.
   */
  readonly diff: (
    branch: string,
    base: string | null
  ) => Effect.Effect<string, GitFailure>;
  /** One file's two sides, from the same two places the diff has. */
  readonly fileDiff: (
    branch: string,
    base: string | null,
    path: string,
    prevPath: string | null
  ) => Effect.Effect<
    {
      readonly oldContents: string | null;
      readonly newContents: string | null;
    },
    GitFailure
  >;
  /**
   * What the worktree has written and not committed, as the file list a commit
   * panel needs. Only its own directory can answer this — no ref knows whether
   * a file has been saved.
   */
  readonly changes: (
    branch: string
  ) => Effect.Effect<ReadonlyArray<GitStatusEntry>, GitFailure>;
  /**
   * Commit in the worktree. The same act as committing here, done there — which
   * is what lets a review of somebody's work end in landing it rather than in a
   * message asking them to commit before it can be read as a merge.
   */
  readonly commit: (
    branch: string,
    message: string,
    paths: ReadonlyArray<string>
  ) => Effect.Effect<MergeOutcome, GitFailure>;
  /**
   * Land a task and take its worktree with it. A task that is behind its base
   * comes back unmerged with the reason, rather than as a git error the surface
   * would have to interpret.
   *
   * `base` lands it somewhere other than what it is aimed at, which re-aims it
   * first so that being ahead and being up to date are judged against the
   * branch it is actually going to.
   */
  readonly merge: (
    branch: string,
    base: string | null
  ) => Effect.Effect<MergeOutcome, GitFailure>;
  /** Bring the base into the task, in the task's own worktree. */
  readonly update: (branch: string) => Effect.Effect<string, GitFailure>;
  /**
   * Stop working on it here: the worktree goes, and with it the services it was
   * running.
   *
   * The branch only goes when it has nothing of its own — a task that never
   * committed leaves no trace worth keeping, while one that did is work, and
   * discarding a directory is not a licence to throw work away. So commits
   * always survive on the branch, and this stays a safe thing to press.
   */
  readonly discard: (branch: string) => Effect.Effect<MergeOutcome, GitFailure>;
}

export class LocalTasksService extends Context.Service<
  LocalTasksService,
  LocalTasksServiceShape
>()("LocalTasksService") {}

/** Record separator — no commit subject or author can contain it. */
const FIELD = "";

export const make: Effect.Effect<
  LocalTasksServiceShape,
  never,
  | GitExec
  | RepoService
  | BranchTargetsService
  | LocalDevService
  | DevRuntime
  | FileSystem.FileSystem
  | ChildProcessSpawner.ChildProcessSpawner
> = Effect.gen(function* () {
  const git = yield* GitExec;
  const fs = yield* FileSystem.FileSystem;
  const repo = yield* RepoService;
  const targets = yield* BranchTargetsService;
  // Captured here rather than asked for per call: everything this service hands
  // back has to be runnable by a handler that knows nothing about worktrees.
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const dev = yield* LocalDevService;
  const runtime = yield* DevRuntime;

  /** Git, pinned to one worktree — the only reason a task touches a directory. */
  const gitAt = (path: string) =>
    Effect.provideService(
      makeAt(path),
      ChildProcessSpawner.ChildProcessSpawner,
      spawner
    );

  const retire = (path: string) =>
    retireCommands(path).pipe(
      Effect.provideService(LocalDevService, dev),
      Effect.provideService(DevRuntime, runtime)
    );

  /** Errors here are the storage's, and a task list is not the place to fail. */
  const aims = Effect.orElseSucceed(targets.list, () => []);

  const isAncestor = (maybe: string, of: string) =>
    git.run("merge-base", "--is-ancestor", maybe, of).pipe(
      Effect.map(() => true),
      Effect.catchTag("GitError", () => Effect.succeed(false))
    );

  const countAhead = (base: string, branch: string) =>
    git.run("rev-list", "--count", `${base}..${branch}`).pipe(
      Effect.map((out) => Number(out.trim()) || 0),
      Effect.catchTag("GitError", () => Effect.succeed(0))
    );

  /**
   * What the task is called, taken from its newest commit that is somebody's
   * actual work.
   *
   * Read across `base..branch` rather than the branch, and skipping merges.
   * Both exclusions say the same thing: a task is named after what it did, and
   * neither a commit it merely inherited from its base nor the merge that
   * brought that in is what it did. Taking the plain tip renames a task after
   * its own bookkeeping the moment it is updated — "Merge branch 'x' into y",
   * which is the one thing the reader already knows.
   *
   * The date comes from the same commit, so the list orders by when the work
   * happened rather than by when it was last tidied.
   */
  const tipOf = (base: string, branch: string) =>
    git
      .run(
        "log",
        "-1",
        "--no-merges",
        `--format=%s${FIELD}%an${FIELD}%aI`,
        `${base}..${branch}`
      )
      .pipe(
        Effect.map((out) => out.trim().split(FIELD)),
        Effect.catchTag("GitError", () => Effect.succeed<Array<string>>([]))
      );

  /**
   * Uncommitted work, asked of the worktree itself — the one fact about a task
   * that only its own directory can answer, since no ref knows whether a file
   * has been saved but not committed.
   */
  const dirtyAt = (path: string) =>
    Effect.flatMap(gitAt(path), (at) =>
      at.run("status", "--porcelain", "--untracked-files=all")
    ).pipe(
      Effect.map((out) => out.trim().length > 0),
      Effect.catchCause(() => Effect.succeed(false))
    );

  const list: LocalTasksServiceShape["list"] = Effect.gen(function* () {
    const [worktrees, recorded] = yield* Effect.all([repo.worktrees, aims], {
      concurrency: "unbounded",
    });
    const mainBranch =
      worktrees.find((worktree) => worktree.isMain)?.branch ?? null;
    const built = yield* Effect.forEach(
      taskWorktrees(worktrees),
      (worktree) =>
        Effect.gen(function* () {
          const base = baseOf(recorded, worktree.branch, mainBranch);
          if (base === null) return [];
          const [ahead, upToDate, dirty, tip] = yield* Effect.all(
            [
              countAhead(base, worktree.branch),
              isAncestor(base, worktree.branch),
              dirtyAt(worktree.path),
              tipOf(base, worktree.branch),
            ],
            { concurrency: "unbounded" }
          );
          return [
            {
              branch: worktree.branch,
              base,
              path: worktree.path,
              name: worktree.name,
              ahead,
              upToDate,
              dirty,
              // A task that has committed nothing yet has no commit to be
              // named after, so it goes by its branch — the name its author
              // actually chose for it.
              subject:
                tip[0] !== undefined && tip[0].length > 0
                  ? tip[0]
                  : worktree.branch,
              author: tip[1] ?? "",
              updatedAt: tip[2] ?? "",
            },
          ];
        }),
      { concurrency: "unbounded" }
    );
    return built.flat();
  });

  const find = (branch: string) =>
    Effect.map(list, (tasks) => tasks.find((task) => task.branch === branch));

  /**
   * A file the task has made but not yet added, as a patch.
   *
   * `git diff` answers about tracked files only, so a whole new file — which is
   * most of what an agent produces — is invisible to it until something stages
   * it. Staging on the reader's behalf is out of the question: the index belongs
   * to whoever is working there. `--no-index` compares two paths as plain files
   * instead, and against `/dev/null` that is exactly the patch that adding it
   * would have produced.
   *
   * It exits 1 when the files differ, which is the normal case here, so the
   * tolerant form is the right one — a non-zero exit is the answer, not a fault.
   */
  const untrackedPatches = (path: string) =>
    Effect.gen(function* () {
      const at = yield* gitAt(path);
      const files = yield* at.lines(
        "ls-files",
        "--others",
        "--exclude-standard"
      );
      const patches = yield* Effect.forEach(files, (file) =>
        at.runTolerant("diff", "--no-index", "--", "/dev/null", file)
      );
      return patches.join("");
    }).pipe(Effect.catchCause(() => Effect.succeed("")));

  /** What the task is read against, with its own base as the answer by default. */
  const baseFor = (task: LocalTask, base: string | null) =>
    base === null || base.length === 0 ? task.base : base;

  const mergeBaseIn = (path: string, base: string) =>
    Effect.flatMap(gitAt(path), (at) =>
      Effect.map(at.run("merge-base", base, "HEAD"), (out) => out.trim())
    );

  const diff: LocalTasksServiceShape["diff"] = (branch, base) =>
    Effect.gen(function* () {
      const task = yield* find(branch);
      if (task === undefined) return "";
      const from = yield* mergeBaseIn(task.path, baseFor(task, base));
      const at = yield* gitAt(task.path);
      const [tracked, untracked] = yield* Effect.all(
        [at.run("diff", from), untrackedPatches(task.path)],
        { concurrency: "unbounded" }
      );
      return `${tracked}${untracked}`;
    });

  const fileDiff: LocalTasksServiceShape["fileDiff"] = (
    branch,
    base,
    path,
    prevPath
  ) =>
    Effect.gen(function* () {
      const task = yield* find(branch);
      if (task === undefined) return { oldContents: null, newContents: null };
      const from = yield* mergeBaseIn(task.path, baseFor(task, base));
      const at = yield* gitAt(task.path);
      // A file that is not in the merge base — one the task added — has no old
      // side, which is what a null says; the same null a deleted file's new
      // side carries.
      const oldContents = yield* at
        .run("show", `${from}:${prevPath ?? path}`)
        .pipe(
          Effect.map((contents): string | null => contents),
          Effect.catchTag("GitError", () => Effect.succeed(null))
        );
      const newContents = yield* fs
        .readFileString(`${task.path}/${path}`)
        .pipe(Effect.catch(() => Effect.succeed<string | null>(null)));
      return { oldContents, newContents };
    });

  const update: LocalTasksServiceShape["update"] = (branch) =>
    Effect.gen(function* () {
      const task = yield* find(branch);
      if (task === undefined) return "";
      const at = yield* gitAt(task.path);
      return yield* at.runVerbose("merge", task.base);
    });

  const discard: LocalTasksServiceShape["discard"] = (branch) =>
    Effect.gen(function* () {
      const task = yield* find(branch);
      if (task === undefined) {
        return { merged: false, reason: "That task is no longer here." };
      }
      yield* retire(task.path);
      yield* repo.removeWorktree(task.path, true);
      // Commits are work; a directory is not. A task that got as far as
      // committing keeps its branch, so discarding is never how something is
      // lost — only a task that has nothing of its own disappears completely.
      if (task.ahead === 0) {
        yield* Effect.ignore(repo.deleteBranch(branch, true));
        yield* Effect.ignore(targets.remove(branch));
      }
      return { merged: false, reason: null };
    });

  const changes: LocalTasksServiceShape["changes"] = (branch) =>
    Effect.gen(function* () {
      const task = yield* find(branch);
      if (task === undefined) return [];
      const at = yield* gitAt(task.path);
      const out = yield* at.run(
        "status",
        "--porcelain",
        "--untracked-files=all"
      );
      return out
        .split("\n")
        .map(parseStatusLine)
        .filter((entry): entry is GitStatusEntry => entry !== null);
    });

  const commit: LocalTasksServiceShape["commit"] = (branch, message, paths) =>
    Effect.gen(function* () {
      const task = yield* find(branch);
      if (task === undefined) {
        return { merged: false, reason: "That worktree is no longer here." };
      }
      const at = yield* gitAt(task.path);
      // Everything, or exactly what was ticked. `add -A` is the same choice the
      // commit panel makes here; a worktree is not a different kind of place.
      if (paths.length === 0) {
        yield* at.run("add", "-A");
        yield* at.run("commit", "-m", message);
      } else {
        yield* at.run("add", "--", ...paths);
        yield* at.run("commit", "-m", message, "--", ...paths);
      }
      return { merged: true, reason: null };
    });

  const merge: LocalTasksServiceShape["merge"] = (branch, base) =>
    Effect.gen(function* () {
      // Aiming first, not merging elsewhere: where a task lands is a fact about
      // the task, and one the rest of the surface reads. Setting it means the
      // count it is ahead by and whether it is up to date are recomputed
      // against the branch it is about to go to, instead of being checked
      // against one branch and applied to another.
      if (base !== null && base.length > 0) {
        yield* Effect.ignore(targets.set(branch, base));
      }
      const task = yield* find(branch);
      if (task === undefined) {
        return { merged: false, reason: "That task is no longer here." };
      }
      const route = mergeRoute(task, yield* repo.worktrees);
      if (route.kind === "behind") {
        return {
          merged: false,
          reason: `‘${branch}’ is behind ‘${route.base}’ — update it first.`,
        };
      }
      if (route.kind === "in-worktree") {
        const at = yield* gitAt(route.path);
        yield* at.runVerbose("merge", branch);
      } else {
        // Nobody is standing on the base, so the branch can simply be moved to
        // where the task got to. Git refuses this unless it is a fast-forward,
        // which `upToDate` has already established.
        yield* git.run("fetch", ".", `${branch}:${task.base}`);
      }
      // The worktree goes only once the work is safely on the base, and its dev
      // commands are stopped and forgotten before the directory does — they are
      // found through the worktree, so afterwards there would be nothing left
      // to look them up by.
      yield* retire(task.path);
      yield* repo.removeWorktree(task.path, true);
      yield* Effect.ignore(repo.deleteBranch(branch, true));
      yield* Effect.ignore(targets.remove(branch));
      return { merged: true, reason: null };
    });

  return LocalTasksService.of({
    list,
    diff,
    fileDiff,
    changes,
    commit,
    merge,
    update,
    discard,
  });
});
