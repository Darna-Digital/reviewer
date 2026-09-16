import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import { VisualCommentsService } from "@reviewer/core/visual-comments";

const ok = { ok: true } as const;

export const VisualCommentsHandler = HttpApiBuilder.group(
  Api,
  "visualComments",
  (handlers) =>
    handlers
      .handle("list", () =>
        Effect.flatMap(VisualCommentsService, (s) => s.list)
      )
      .handle("add", ({ payload }) =>
        Effect.flatMap(VisualCommentsService, (s) =>
          s.add({
            url: payload.url,
            selector: payload.selector,
            elementLabel: payload.elementLabel,
            body: payload.body,
            author:
              payload.author !== undefined && payload.author.length > 0
                ? payload.author
                : "you",
            screenshot: payload.screenshot ?? null,
            viewport: payload.viewport,
            styleChanges: payload.styleChanges ?? [],
            anchor: payload.anchor ?? { x: 8, y: 8 },
          })
        )
      )
      .handle("update", ({ params, payload }) =>
        Effect.flatMap(VisualCommentsService, (s) =>
          s.update(params.id, {
            body: payload.body,
            ...(payload.styleChanges !== undefined
              ? { styleChanges: payload.styleChanges }
              : {}),
          })
        )
      )
      .handle("remove", ({ params }) =>
        Effect.flatMap(VisualCommentsService, (s) => s.remove(params.id)).pipe(
          Effect.as(ok)
        )
      )
);
