/**
 * What happens to a worktree's services as worktrees come and go: one follows
 * focus, a new one inherits, a retired one takes its own with it.
 *
 * One dev server, on whichever worktree you are looking at.
 *
 * Two worktrees of one repository run the same app, so they want the same port
 * and cannot both hold it. When focus moves between them the services move
 * with it: whatever was running in the worktree you left is stopped, and the
 * command of the same name is started in the one you arrived at.
 *
 * What travels is the *set of names that were running*, not a marked-primary
 * command — so nothing has to be configured, and a worktree you left idle
 * arrives idle. Roots that are genuinely different repositories (a project's
 * `backend` beside its `frontend`) are left alone: they do not collide, and
 * killing one to look at the other is the behaviour this replaces.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { LocalDevService } from "@byconvo/core/local-dev";
import { mainRepoOf } from "../workspace/main-repo.ts";
import { DevRuntime } from "./local-dev.runtime.ts";
import type { DevCommand } from "@byconvo/core/local-dev";

/** The commands in `to` that stand in for the ones that were running in `from`. */
export const commandsToFollow = (
  commands: ReadonlyArray<DevCommand>,
  runningNames: ReadonlySet<string>,
  to: string
): ReadonlyArray<DevCommand> =>
  commands.filter(
    (command) => command.repoPath === to && runningNames.has(command.name)
  );

export const followFocus = (
  from: string | null,
  to: string
): Effect.Effect<
  void,
  never,
  FileSystem.FileSystem | LocalDevService | DevRuntime
> =>
  Effect.gen(function* () {
    if (from === null || from === to) return;
    const fs = yield* FileSystem.FileSystem;
    const [fromRepo, toRepo] = yield* Effect.all([
      mainRepoOf(fs, from),
      mainRepoOf(fs, to),
    ]);
    if (fromRepo !== toRepo) return;

    const dev = yield* LocalDevService;
    const runtime = yield* DevRuntime;
    const commands = yield* dev.list;
    const left = commands.filter((command) => command.repoPath === from);
    const statuses = yield* Effect.forEach(left, (command) =>
      Effect.map(runtime.status(command.id), (status) => ({ command, status }))
    );
    const runningNames = new Set(
      statuses
        .filter((entry) => entry.status?.status === "running")
        .map((entry) => entry.command.name)
    );
    if (runningNames.size === 0) return;

    yield* runtime.stopRepo(from);
    yield* Effect.forEach(
      commandsToFollow(commands, runningNames, to),
      (command) =>
        runtime.start({
          commandId: command.id,
          repoPath: command.repoPath,
          command: command.command,
        })
    );
  }).pipe(
    // A handoff that cannot be worked out must never fail the selection: the
    // user asked to look somewhere else, not to run anything.
    Effect.catchCause(() => Effect.void)
  );

/**
 * Give a fresh worktree the same services as the one it was cut from.
 *
 * Commands belong to the worktree that runs them, so one made a moment ago has
 * none and its Services panel would open empty — for a worktree of a
 * repository that plainly runs the same app. Copied rather than shared, so a
 * task that needs a different command can change it without changing the rest.
 */
export const seedCommands = (
  from: string,
  to: string
): Effect.Effect<void, never, LocalDevService> =>
  Effect.gen(function* () {
    const dev = yield* LocalDevService;
    const commands = yield* dev.list;
    yield* Effect.forEach(
      commands.filter((command) => command.repoPath === from),
      (command) =>
        dev.create({
          name: command.name,
          command: command.command,
          repoPath: to,
        })
    );
  }).pipe(Effect.catchCause(() => Effect.void));

/**
 * Stop and forget what a worktree ran, before the worktree itself goes.
 *
 * Order matters: a command is found through the worktrees the project can be
 * pointed at, so once `git worktree remove` has run there is no longer anything
 * to look it up by and its rows would sit in the database unreachable.
 */
export const retireCommands = (
  repoPath: string
): Effect.Effect<void, never, LocalDevService | DevRuntime> =>
  Effect.gen(function* () {
    const dev = yield* LocalDevService;
    const runtime = yield* DevRuntime;
    const commands = yield* dev.list;
    yield* runtime.stopRepo(repoPath);
    yield* Effect.forEach(
      commands.filter((command) => command.repoPath === repoPath),
      (command) => dev.remove(command.id)
    );
  }).pipe(Effect.catchCause(() => Effect.void));
