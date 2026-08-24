import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import {
  CHAT_MODEL_CATALOG,
  ChatsService,
  parseChatListQuery,
} from "@byconvo/core/chats";

const ok = { ok: true } as const;
const defaults = CHAT_MODEL_CATALOG.defaults;

export const ChatsHandler = HttpApiBuilder.group(Api, "chats", (handlers) =>
  handlers
    .handle("list", ({ query }) =>
      Effect.flatMap(ChatsService, (s) => s.list(parseChatListQuery(query)))
    )
    .handle("models", () => Effect.flatMap(ChatsService, (s) => s.models))
    .handle("projects", () => Effect.flatMap(ChatsService, (s) => s.projects))
    .handle("create", ({ payload }) =>
      Effect.flatMap(ChatsService, (s) =>
        s.create({
          title: payload.title ?? "",
          provider: payload.provider ?? defaults.provider,
          model: payload.model ?? defaults.model,
          effort: payload.effort ?? defaults.effort,
          access: payload.access ?? defaults.access,
          branch: payload.branch ?? "",
          ...(payload.repoPath === undefined
            ? {}
            : { repoPath: payload.repoPath }),
        })
      )
    )
    .handle("get", ({ params }) =>
      Effect.flatMap(ChatsService, (s) => s.get(params.id))
    )
    .handle("update", ({ params, payload }) =>
      Effect.flatMap(ChatsService, (s) =>
        s.update(params.id, {
          title: payload.title,
          provider: payload.provider,
          model: payload.model,
          effort: payload.effort,
          access: payload.access,
        })
      )
    )
    .handle("send", ({ params, payload }) =>
      Effect.flatMap(ChatsService, (s) =>
        s.send(params.id, payload.text, payload.images ?? [])
      )
    )
    .handle("seen", ({ params }) =>
      Effect.flatMap(ChatsService, (s) => s.markSeen(params.id)).pipe(
        Effect.as(ok)
      )
    )
    .handle("stop", ({ params }) =>
      // ok:false = nothing was running (already settled) — not an error.
      Effect.flatMap(ChatsService, (s) => s.stop(params.id))
    )
    .handle("remove", ({ params }) =>
      Effect.flatMap(ChatsService, (s) => s.remove(params.id)).pipe(
        Effect.as(ok)
      )
    )
);
