import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { CloudService } from "@reviewer/core/cloud";
import { Api } from "../../api.ts";

export const CloudHandler = HttpApiBuilder.group(Api, "cloud", (handlers) =>
  handlers
    .handle("status", () => Effect.flatMap(CloudService, (s) => s.status))
    .handle("connect", ({ payload }) =>
      Effect.flatMap(CloudService, (s) => s.connect(payload.serverUrl))
    )
    .handle("poll", () => Effect.flatMap(CloudService, (s) => s.poll))
    .handle("disconnect", () =>
      Effect.flatMap(CloudService, (s) => s.disconnect)
    )
    .handle("connectAgent", ({ params }) =>
      Effect.map(
        Effect.flatMap(CloudService, (s) => s.connectAgent(params.provider)),
        (connected) => ({ provider: params.provider, ...connected })
      )
    )
    .handle("repos", () => Effect.flatMap(CloudService, (s) => s.repos))
    .handle("runs", () => Effect.flatMap(CloudService, (s) => s.runs))
    .handle("createRun", ({ payload }) =>
      Effect.flatMap(CloudService, (s) => s.createRun(payload))
    )
    .handle("run", ({ params }) =>
      Effect.flatMap(CloudService, (s) => s.run(params.id))
    )
    .handle("send", ({ params, payload }) =>
      Effect.flatMap(CloudService, (s) => s.send(params.id, payload.prompt))
    )
    .handle("cancel", ({ params }) =>
      Effect.flatMap(CloudService, (s) => s.cancel(params.id))
    )
);
