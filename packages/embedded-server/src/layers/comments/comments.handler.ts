import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import { CommentsService } from "@reviewer/core/comments";
import { authorOf } from "../git/git-identity.ts";

const ok = { ok: true } as const;

export const CommentsHandler = HttpApiBuilder.group(
  Api,
  "comments",
  (handlers) =>
    handlers
      .handle("list", () => Effect.flatMap(CommentsService, (s) => s.list))
      .handle("add", ({ payload }) =>
        Effect.gen(function* () {
          const comments = yield* CommentsService;
          return yield* comments.add({
            filePath: payload.filePath,
            side: payload.side,
            lineNumber: payload.lineNumber,
            body: payload.body,
            author: yield* authorOf(payload.author),
            target: payload.target ?? "worktree",
          });
        })
      )
      .handle("update", ({ params, payload }) =>
        Effect.flatMap(CommentsService, (s) =>
          s.update(params.id, { body: payload.body })
        )
      )
      .handle("remove", ({ params }) =>
        Effect.flatMap(CommentsService, (s) => s.remove(params.id)).pipe(
          Effect.as(ok)
        )
      )
);
