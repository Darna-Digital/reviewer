import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import { PlansService } from "@reviewer/core/plans";

const ok = { ok: true } as const;

export const PlansHandler = HttpApiBuilder.group(Api, "plans", (handlers) =>
  handlers
    .handle("list", () => Effect.flatMap(PlansService, (s) => s.list))
    .handle("get", ({ params }) =>
      Effect.flatMap(PlansService, (s) => s.view(params.id))
    )
    .handle("create", ({ payload }) =>
      Effect.flatMap(PlansService, (s) =>
        s.create({
          title: payload.title,
          question: payload.question ?? "",
          nodes: payload.nodes,
          edges: payload.edges,
          annotations: payload.annotations ?? [],
        })
      )
    )
    .handle("save", ({ params }) =>
      Effect.flatMap(PlansService, (s) => s.save(params.id))
    )
    .handle("annotate", ({ params, payload }) =>
      Effect.flatMap(PlansService, (s) =>
        s.addAnnotation(params.id, {
          nodeId: payload.nodeId ?? null,
          body: payload.body,
          author:
            payload.author !== undefined && payload.author.length > 0
              ? payload.author
              : "you",
          anchor: payload.anchor ?? null,
        })
      )
    )
    .handle("removeAnnotation", ({ params }) =>
      Effect.flatMap(PlansService, (s) =>
        s.removeAnnotation(params.id, params.annotationId)
      )
    )
    .handle("remove", ({ params }) =>
      Effect.flatMap(PlansService, (s) => s.remove(params.id)).pipe(
        Effect.as(ok)
      )
    )
);
