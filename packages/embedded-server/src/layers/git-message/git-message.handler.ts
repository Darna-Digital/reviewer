import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import {
  DEFAULT_COMMIT_AGENT,
  GitMessageService,
} from "@byconvo/core/git-message";

export const GitMessageHandler = HttpApiBuilder.group(
  Api,
  "gitMessage",
  (handlers) =>
    handlers.handle("generate", ({ payload }) =>
      Effect.flatMap(GitMessageService, (s) =>
        s.generate(payload.paths ?? [], payload.agent ?? DEFAULT_COMMIT_AGENT)
      ).pipe(Effect.map((message) => ({ message })))
    )
);
