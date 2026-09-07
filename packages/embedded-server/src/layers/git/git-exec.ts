/**
 * GitExec — runs the `git` CLI in the currently selected repository. The
 * server's "connection to git": feature repositories build their queries on
 * top of `run` / `runVerbose` / `lines` exactly as the darna-stack DB
 * repositories build on `RawSql`.
 *
 * Everything the server asks of git comes through here, which is what makes
 * `.git/index.lock` manageable. Git guards the index with a lockfile it refuses
 * to queue for: a second command wanting it fails outright with "Unable to
 * create '.../index.lock': File exists". Three things arrange for that here.
 *
 * Reads say `--no-optional-locks`, so a status or a diff never takes the lock
 * merely to write back a freshened index — and the app reads constantly, in
 * parallel bursts, because every mutation invalidates every query.
 *
 * Writes queue behind one permit per repository, so the server never races
 * itself: a commit, the discard next to it and the `add` inside a conflict
 * resolution take their turn instead of colliding.
 *
 * Whoever else holds it waits out a few short retries. An agent CLI in a
 * terminal thread, a shell, an editor's own git integration — none of them are
 * ours to queue, and the failure they cause is one nothing had happened for, so
 * it is safe to simply ask again.
 */
import type * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { rmSync, statSync } from "node:fs";
import { NoRepoSelected } from "@reviewer/core/shared";
import {
  GitError,
  GitExec,
  type GitExecShape,
  type GitFailure,
} from "@reviewer/core/ports/git-exec";
import { WorkspaceContext } from "../workspace/workspace-context.ts";

export {
  GitExec,
  type GitExecShape,
  type GitFailure,
} from "@reviewer/core/ports/git-exec";

interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/** Subcommands that take the index lock, and so may not run alongside another. */
const WRITES_INDEX = new Set([
  "add",
  "apply",
  "cherry-pick",
  "checkout",
  "clean",
  "commit",
  "merge",
  "mv",
  "pull",
  "rebase",
  "reset",
  "restore",
  "revert",
  "rm",
  "stash",
  "switch",
  "update-index",
]);

/** Git-level options that swallow the argument after them. */
const OPTION_WITH_VALUE = new Set(["-c", "-C", "--config-env", "--git-dir"]);

/** What a command actually does, past the git-level options in front of it. */
export const subcommandOf = (args: ReadonlyArray<string>): string => {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? "";
    if (OPTION_WITH_VALUE.has(arg)) index++;
    else if (!arg.startsWith("-")) return arg;
  }
  return "";
};

const LOCK_HELD =
  /(index|shallow|HEAD|config|packed-refs)\.lock.*(File exists|already exists)|Another git process/i;

const lockHeld = (result: CommandResult): boolean =>
  result.exitCode !== 0 && LOCK_HELD.test(result.stderr);

/** Long enough to outlast a passing command, short enough not to read as a hang. */
const LOCK_WAITS: ReadonlyArray<Duration.Input> = [
  "120 millis",
  "300 millis",
  "700 millis",
];

/**
 * A lock still held once the waits are spent is worth explaining: the message
 * git prints says what happened but not that something else in the machine is
 * holding the repository, nor that a killed process can leave the file behind.
 */
const lockHeldText = (stderr: string, gitDir: string): string =>
  `${stderr.trim()}\n\nAnother program is using this repository. If nothing else is running, a crashed command may have left the lock behind — remove ${gitDir}/index.lock and try again.`;

/**
 * How long an untouched lock has to sit before it counts as abandoned. A git
 * that is working writes the new index into the lock and renames it into place
 * at the end, so an empty one this old belongs to a process that died holding it
 * — the dev server restarting on a file change, the app quitting, a request
 * dropped mid-commit. Nothing else clears it, and until something does, every
 * commit in that repository fails.
 *
 * Being wrong costs a failed command, not a broken repository: a git we take the
 * lock from finds its rename has nothing to rename and stops, leaving the index
 * as it was.
 */
const ABANDONED_AFTER_MS = 30_000;

const abandonedLock = (lockPath: string): boolean => {
  try {
    const stat = statSync(lockPath);
    return stat.size === 0 && Date.now() - stat.mtimeMs > ABANDONED_AFTER_MS;
  } catch {
    return false;
  }
};

const removeLock = (lockPath: string): boolean => {
  try {
    rmSync(lockPath);
    console.warn(`reviewer: cleared an abandoned git lock at ${lockPath}`);
    return true;
  } catch {
    return false;
  }
};

/** One permit per repository root, for the life of the process. */
const indexPermits = new Map<string, Semaphore.Semaphore>();
const indexPermitFor = (root: string): Semaphore.Semaphore => {
  const existing = indexPermits.get(root);
  if (existing !== undefined) return existing;
  const created = Semaphore.makeUnsafe(1);
  indexPermits.set(root, created);
  return created;
};

/**
 * A GitExec running in whatever root `resolveRoot` yields. The selected repo is
 * the usual answer; a project view that reads every root it holds asks for one
 * of these per root instead, so the same query code serves both.
 */
export const makeIn = (resolveRoot: Effect.Effect<string, NoRepoSelected>) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

    const spawnIn = (
      repoPath: string,
      args: ReadonlyArray<string>
    ): Effect.Effect<CommandResult, GitFailure> =>
      Effect.scoped(
        Effect.gen(function* () {
          const handle = yield* spawner.spawn(
            ChildProcess.make("git", args as Array<string>, { cwd: repoPath })
          );
          const [stdout, stderr, exitCode] = yield* Effect.all(
            [
              Stream.mkString(Stream.decodeText(handle.stdout)),
              Stream.mkString(Stream.decodeText(handle.stderr)),
              handle.exitCode,
            ],
            { concurrency: "unbounded" }
          );
          return { stdout, stderr, exitCode };
        })
      ).pipe(
        // Spawn/IO failures (git missing, decode errors) become GitError so the
        // public error channel stays schema-friendly; NoRepoSelected passes through.
        Effect.catch((error): Effect.Effect<never, GitFailure> =>
          Effect.fail(
            error instanceof NoRepoSelected
              ? error
              : new GitError({
                  args,
                  exitCode: -1,
                  stderr:
                    error instanceof Error ? error.message : String(error),
                })
          )
        )
      );

    const spawnAwaitingLock = (
      repoPath: string,
      args: ReadonlyArray<string>,
      waits: ReadonlyArray<Duration.Input> = LOCK_WAITS
    ): Effect.Effect<CommandResult, GitFailure> =>
      spawnIn(repoPath, args).pipe(
        Effect.flatMap((result) =>
          !lockHeld(result) || waits.length === 0
            ? Effect.succeed(result)
            : Effect.delay(
                spawnAwaitingLock(repoPath, args, waits.slice(1)),
                waits[0] ?? "120 millis"
              )
        )
      );

    /** Where the repository keeps its locks — `.git` may be a file, not a dir. */
    const gitDirOf = (repoPath: string): Effect.Effect<string> =>
      spawnIn(repoPath, [
        "--no-optional-locks",
        "rev-parse",
        "--absolute-git-dir",
      ]).pipe(
        Effect.map(({ exitCode, stdout }) =>
          exitCode === 0 && stdout.trim().length > 0
            ? stdout.trim()
            : `${repoPath}/.git`
        ),
        Effect.catch(() => Effect.succeed(`${repoPath}/.git`))
      );

    /**
     * A write that the waits could not get the lock for: whatever holds it has
     * either gone (an abandoned lock, cleared here so the command can go
     * through) or is still working, which is what the message then says.
     */
    const recoverOrExplain = (
      repoPath: string,
      args: ReadonlyArray<string>,
      result: CommandResult
    ): Effect.Effect<CommandResult, GitFailure> =>
      Effect.gen(function* () {
        const gitDir = yield* gitDirOf(repoPath);
        const lockPath = `${gitDir}/index.lock`;
        if (abandonedLock(lockPath) && removeLock(lockPath)) {
          const retried = yield* spawnAwaitingLock(repoPath, args);
          if (!lockHeld(retried)) return retried;
          return { ...retried, stderr: lockHeldText(retried.stderr, gitDir) };
        }
        return { ...result, stderr: lockHeldText(result.stderr, gitDir) };
      });

    const spawn = (
      args: ReadonlyArray<string>
    ): Effect.Effect<CommandResult, GitFailure> =>
      Effect.gen(function* () {
        const repoPath = yield* resolveRoot;
        if (!WRITES_INDEX.has(subcommandOf(args))) {
          return yield* spawnAwaitingLock(repoPath, [
            "--no-optional-locks",
            ...args,
          ]);
        }
        // Uninterruptible: a request that goes away mid-write — a reload, a
        // closed window — used to take the git holding the index with it, and a
        // git killed between taking the lock and renaming it into place is
        // exactly what leaves the lock behind for everything after it.
        return yield* indexPermitFor(repoPath).withPermits(1)(
          Effect.uninterruptible(
            Effect.flatMap(spawnAwaitingLock(repoPath, args), (result) =>
              lockHeld(result)
                ? recoverOrExplain(repoPath, args, result)
                : Effect.succeed(result)
            )
          )
        );
      });

    // Some git commands report the reason for a non-zero exit on stdout, not
    // stderr — e.g. `commit` prints "nothing to commit, working tree clean" to
    // stdout. Fall back to stdout so the GitError never carries an empty message.
    const failureText = (stderr: string, stdout: string): string =>
      stderr.trim().length > 0 ? stderr : stdout;

    const run: GitExecShape["run"] = (...args) =>
      spawn(args).pipe(
        Effect.flatMap(({ exitCode, stderr, stdout }) =>
          exitCode !== 0
            ? Effect.fail(
                new GitError({
                  args,
                  exitCode,
                  stderr: failureText(stderr, stdout),
                })
              )
            : Effect.succeed(stdout)
        )
      );

    const runVerbose: GitExecShape["runVerbose"] = (...args) =>
      spawn(args).pipe(
        Effect.flatMap(({ exitCode, stderr, stdout }) =>
          exitCode !== 0
            ? Effect.fail(
                new GitError({
                  args,
                  exitCode,
                  stderr: failureText(stderr, stdout),
                })
              )
            : Effect.succeed(`${stdout}${stderr}`.trim())
        )
      );

    const runTolerant: GitExecShape["runTolerant"] = (...args) =>
      spawn(args).pipe(Effect.map(({ stdout }) => stdout));

    const lines: GitExecShape["lines"] = (...args) =>
      run(...args).pipe(
        Effect.map((out) => out.split("\n").filter((line) => line.length > 0))
      );

    return GitExec.of({ run, runVerbose, runTolerant, lines });
  });

/** A GitExec pinned to one root — how a project view reads each of its own. */
export const makeAt = (root: string) => makeIn(Effect.succeed(root));

/** The default: git runs wherever the workspace's selected repository is. */
export const make = Effect.flatMap(WorkspaceContext, (workspace) =>
  makeIn(workspace.requireCurrent)
);

export const layer: Layer.Layer<
  GitExec,
  never,
  ChildProcessSpawner.ChildProcessSpawner | WorkspaceContext
> = Layer.effect(GitExec)(make);
