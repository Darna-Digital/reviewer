import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import {
  DEFAULT_COMMIT_AGENT,
  GitMessageService,
} from "@byconvo/core/git-message";
import { WorkspaceContext } from "../workspace/workspace-context.ts";

/**
 * A draft belongs to the open project, not to the page that asked for it: any
 * window looking at that project — including the one that reloads while the
 * CLI is still writing — reads the same run.
 */
const openProject = Effect.gen(function* () {
  const workspace = yield* WorkspaceContext;
  const project = yield* workspace.project;
  return project ?? "";
});

export const GitMessageHandler = HttpApiBuilder.group(
  Api,
  "gitMessage",
  (handlers) =>
    handlers
      .handle("generate", ({ payload }) =>
        Effect.gen(function* () {
          const service = yield* GitMessageService;
          return yield* service.start(
            yield* openProject,
            payload.paths ?? [],
            payload.agent ?? DEFAULT_COMMIT_AGENT
          );
        })
      )
      .handle("draft", () =>
        Effect.gen(function* () {
          const service = yield* GitMessageService;
          return yield* service.draft(yield* openProject);
        })
      )
      .handle("clearDraft", () =>
        Effect.gen(function* () {
          const service = yield* GitMessageService;
          return yield* service.clear(yield* openProject);
        })
      )
);
