import { statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { NotFound } from "@reviewer/core/shared";
import { Api } from "../../api.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import type { DevRunStatus } from "../terminal/dev-process-manager.ts";
import { DevRuntime, type StartCommandInput } from "./local-dev.runtime.ts";
import type { DevCommand, DevCommandView } from "@reviewer/core/local-dev";
import { LocalDevService } from "@reviewer/core/local-dev";

const ok = { ok: true } as const;

/**
 * The absolute folder a command runs in: its `cwd` under the repository,
 * which has to still be a folder there — a package renamed since the command
 * was written is a NotFound rather than a process started somewhere else.
 */
const commandFolder = (
  repoPath: string,
  command: DevCommand
): Effect.Effect<string, NotFound> => {
  const folder = resolve(join(repoPath, command.cwd));
  const inside = !relative(repoPath, folder).startsWith("..");
  const isFolder = (() => {
    try {
      return statSync(folder).isDirectory();
    } catch {
      return false;
    }
  })();
  if (!inside || !isFolder) {
    return Effect.fail(
      new NotFound({
        reason: `folder ${command.cwd || "."} not found in repository`,
      })
    );
  }
  return Effect.succeed(folder);
};

/**
 * Opening the app is all a `docker-desktop` command is: the engine comes up
 * behind it in its own time. Not `open -g`, which would spare the user the
 * focus: Docker Desktop launched hidden cannot start the Electron process
 * behind its menu-bar tray, and its backend crashes a few seconds in.
 *
 * Not `docker desktop start` either — its CLI plugin declines to launch the
 * app at all under the environment the dev shell inherits, and then blocks
 * forever waiting for an engine nothing is starting.
 */
const DOCKER_DESKTOP_COMMAND = "open -a Docker";

/**
 * What the runtime starts for a command: a shell command as written, in its
 * folder; a Docker Desktop command at the repository root, since the app is
 * not the repository's to run from anywhere in particular.
 */
const launch = (
  repoPath: string,
  command: DevCommand
): Effect.Effect<StartCommandInput, NotFound> =>
  command.kind === "docker-desktop"
    ? Effect.succeed({
        commandId: command.id,
        repoPath,
        cwd: repoPath,
        command: DOCKER_DESKTOP_COMMAND,
      })
    : Effect.map(commandFolder(repoPath, command), (cwd) => ({
        commandId: command.id,
        repoPath,
        cwd,
        command: command.command,
      }));

/** Merge a stored definition with its (optional) runtime status into a view. */
const toView = (
  command: DevCommand,
  status: DevRunStatus | null
): DevCommandView => ({
  ...command,
  status: status?.status ?? "stopped",
  exitCode: status?.exitCode ?? null,
});

export const LocalDevHandler = HttpApiBuilder.group(
  Api,
  "localDev",
  (handlers) =>
    handlers
      .handle("list", () =>
        Effect.gen(function* () {
          const dev = yield* LocalDevService;
          const runtime = yield* DevRuntime;
          const commands = yield* dev.list;
          return yield* Effect.forEach(commands, (command) =>
            Effect.map(runtime.status(command.id), (status) =>
              toView(command, status)
            )
          );
        })
      )
      .handle("create", ({ payload }) =>
        Effect.flatMap(LocalDevService, (s) =>
          s.create({
            kind: payload.kind,
            name: payload.name,
            command: payload.command,
            cwd: payload.cwd,
          })
        )
      )
      .handle("get", ({ params }) =>
        Effect.flatMap(LocalDevService, (s) => s.get(params.id))
      )
      .handle("update", ({ params, payload }) =>
        Effect.flatMap(LocalDevService, (s) =>
          s.update(params.id, {
            name: payload.name,
            command: payload.command,
            cwd: payload.cwd,
          })
        )
      )
      .handle("remove", ({ params }) =>
        Effect.gen(function* () {
          const dev = yield* LocalDevService;
          const runtime = yield* DevRuntime;
          // Stop a running process before forgetting its definition.
          yield* runtime.stop(params.id);
          yield* dev.remove(params.id);
          return ok;
        })
      )
      .handle("start", ({ params }) =>
        Effect.gen(function* () {
          const dev = yield* LocalDevService;
          const runtime = yield* DevRuntime;
          const ctx = yield* WorkspaceContext;
          const repoPath = yield* ctx.requireCurrent;
          const command = yield* dev.get(params.id);
          const status = yield* runtime.start(yield* launch(repoPath, command));
          return toView(command, status);
        })
      )
      .handle("stop", ({ params }) =>
        Effect.flatMap(DevRuntime, (r) => r.stop(params.id)).pipe(Effect.as(ok))
      )
      .handle("startAll", () =>
        Effect.gen(function* () {
          const dev = yield* LocalDevService;
          const runtime = yield* DevRuntime;
          const ctx = yield* WorkspaceContext;
          const repoPath = yield* ctx.requireCurrent;
          const commands = yield* dev.list;
          const views: DevCommandView[] = [];
          for (const command of commands) {
            const status = yield* runtime.start(
              yield* launch(repoPath, command)
            );
            views.push(toView(command, status));
          }
          return views;
        })
      )
      .handle("stopAll", () =>
        Effect.gen(function* () {
          const runtime = yield* DevRuntime;
          const ctx = yield* WorkspaceContext;
          yield* runtime.stopRepo(yield* ctx.requireCurrent);
          return ok;
        })
      )
);
