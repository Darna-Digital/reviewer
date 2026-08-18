import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import {
  DEFAULT_COMMIT_AGENT,
  GitMessageService,
} from "@byconvo/core/git-message";
import { LocalTasksService } from "../local-tasks/local-tasks.service.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";

/**
 * A draft belongs to the open project, not to the page that asked for it: any
 * window looking at that project — including the one that reloads while the
 * CLI is still writing — reads the same run.
 *
 * A worktree under review is its own slot within that project. Two changes are
 * being written at once whenever somebody reviews a worktree while their own
 * checkout is dirty, and one drafting run cannot answer for both — the second
 * would either be refused as already running or overwrite the first's message.
 */
const scopeOf = (worktree: string | null) =>
  Effect.gen(function* () {
    const workspace = yield* WorkspaceContext;
    const project = (yield* workspace.project) ?? "";
    return worktree === null ? project : `${project}\u0000${worktree}`;
  });

/**
 * Where a worktree's branch lives on disk, or null for this checkout. A list
 * that cannot be read answers null rather than failing: drafting against the
 * selected repository is a worse message, not a broken endpoint.
 */
const treeOf = (worktree: string | null) =>
  worktree === null
    ? Effect.succeed(null)
    : Effect.flatMap(LocalTasksService, (s) => s.list).pipe(
        Effect.map(
          (tasks) =>
            tasks.find((task) => task.branch === worktree)?.path ?? null
        ),
        Effect.orElseSucceed(() => null)
      );

export const GitMessageHandler = HttpApiBuilder.group(
  Api,
  "gitMessage",
  (handlers) =>
    handlers
      .handle("generate", ({ payload }) =>
        Effect.gen(function* () {
          const service = yield* GitMessageService;
          const worktree = payload.worktree ?? null;
          return yield* service.start(
            yield* scopeOf(worktree),
            payload.paths ?? [],
            payload.agent ?? DEFAULT_COMMIT_AGENT,
            yield* treeOf(worktree)
          );
        })
      )
      .handle("draft", ({ query }) =>
        Effect.gen(function* () {
          const service = yield* GitMessageService;
          return yield* service.draft(yield* scopeOf(query.worktree ?? null));
        })
      )
      .handle("clearDraft", ({ payload }) =>
        Effect.gen(function* () {
          const service = yield* GitMessageService;
          return yield* service.clear(yield* scopeOf(payload.worktree ?? null));
        })
      )
);
