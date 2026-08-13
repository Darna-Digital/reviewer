import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import type { DevRunStatus } from "../terminal/dev-process-manager.ts";
import { DevRuntime } from "./local-dev.runtime.ts";
import type { DevCommand, DevCommandView } from "@byconvo/core/local-dev";
import { LocalDevService } from "@byconvo/core/local-dev";

const ok = { ok: true } as const;

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
            name: payload.name,
            command: payload.command,
            repoPath: payload.repoPath,
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
            repoPath: payload.repoPath,
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
          const command = yield* dev.get(params.id);
          const status = yield* runtime.start({
            commandId: command.id,
            repoPath: command.repoPath,
            command: command.command,
          });
          return toView(command, status);
        })
      )
      .handle("stop", ({ params }) =>
        Effect.flatMap(DevRuntime, (r) => r.stop(params.id)).pipe(Effect.as(ok))
      )
      .handle("startAll", ({ payload }) =>
        Effect.gen(function* () {
          const dev = yield* LocalDevService;
          const runtime = yield* DevRuntime;
          const commands = yield* dev.list;
          // Each command runs in the root it belongs to, so a project's backend
          // and frontend come up together from one Run all.
          const scoped =
            payload.repoPath === undefined
              ? commands
              : commands.filter((c) => c.repoPath === payload.repoPath);
          const views: DevCommandView[] = [];
          for (const command of scoped) {
            const status = yield* runtime.start({
              commandId: command.id,
              repoPath: command.repoPath,
              command: command.command,
            });
            views.push(toView(command, status));
          }
          return views;
        })
      )
      .handle("stopAll", ({ payload }) =>
        Effect.gen(function* () {
          const runtime = yield* DevRuntime;
          const ctx = yield* WorkspaceContext;
          if (payload.repoPath !== undefined) {
            yield* runtime.stopRepo(payload.repoPath);
            return ok;
          }
          yield* runtime.stopProject(yield* ctx.requireProject);
          return ok;
        })
      )
);
