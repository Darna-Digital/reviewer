import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { NotFound } from "@byconvo/core/shared";
import type { CollabTargetKind } from "@byconvo/core/collab";
import { CollabService } from "@byconvo/core/collab";
import { Api } from "../../api.ts";

const ok = { ok: true } as const;

const TARGET_KINDS: ReadonlyArray<CollabTargetKind> = [
  "project",
  "todo",
  "note",
];

/**
 * A bookmark's target kind arrives in the path, where the type system cannot
 * reach it. Anything that is not one of the three is a 404 rather than a
 * decode failure: the client asked to un-star something that cannot exist,
 * which is the same answer as asking for a project that does not.
 */
const targetKind = (
  value: string
): Effect.Effect<CollabTargetKind, NotFound> => {
  const kind = TARGET_KINDS.find((candidate) => candidate === value);
  return kind === undefined
    ? Effect.fail(new NotFound({ reason: `unknown bookmark kind "${value}"` }))
    : Effect.succeed(kind);
};

export const CollabHandler = HttpApiBuilder.group(Api, "collab", (handlers) =>
  handlers
    .handle("home", () => Effect.flatMap(CollabService, (s) => s.home))
    .handle("mine", ({ query }) =>
      Effect.flatMap(CollabService, (s) => s.mine(query.viewer ?? ""))
    )
    .handle("createProject", ({ payload }) =>
      Effect.flatMap(CollabService, (s) =>
        s.createProject({
          name: payload.name,
          purpose: payload.purpose ?? "",
          ...(payload.color === undefined ? {} : { color: payload.color }),
        })
      )
    )
    .handle("project", ({ params }) =>
      Effect.flatMap(CollabService, (s) => s.detail(params.id))
    )
    .handle("updateProject", ({ params, payload }) =>
      Effect.flatMap(CollabService, (s) => s.updateProject(params.id, payload))
    )
    .handle("removeProject", ({ params }) =>
      Effect.flatMap(CollabService, (s) => s.removeProject(params.id)).pipe(
        Effect.as(ok)
      )
    )
    .handle("board", ({ params }) =>
      Effect.flatMap(CollabService, (s) => s.board(params.id))
    )
    .handle("addList", ({ params, payload }) =>
      Effect.flatMap(CollabService, (s) => s.addList(params.id, payload.name))
    )
    .handle("updateList", ({ params, payload }) =>
      Effect.flatMap(CollabService, (s) =>
        s.updateList(params.id, params.listId, payload)
      )
    )
    .handle("removeList", ({ params }) =>
      Effect.flatMap(CollabService, (s) =>
        s.removeList(params.id, params.listId)
      )
    )
    .handle("createTodo", ({ params, payload }) =>
      Effect.flatMap(CollabService, (s) => s.createTodo(params.id, payload))
    )
    .handle("updateTodo", ({ params, payload }) =>
      Effect.flatMap(CollabService, (s) => s.updateTodo(params.id, payload))
    )
    .handle("removeTodo", ({ params }) =>
      Effect.flatMap(CollabService, (s) => s.removeTodo(params.id)).pipe(
        Effect.as(ok)
      )
    )
    .handle("notes", () => Effect.flatMap(CollabService, (s) => s.notes))
    .handle("createNote", ({ payload }) =>
      Effect.flatMap(CollabService, (s) =>
        s.createNote({
          title: payload.title,
          projectId: payload.projectId ?? "",
          content: payload.content ?? "",
        })
      )
    )
    .handle("note", ({ params }) =>
      Effect.flatMap(CollabService, (s) => s.note(params.id))
    )
    .handle("updateNote", ({ params, payload }) =>
      Effect.flatMap(CollabService, (s) => s.updateNote(params.id, payload))
    )
    .handle("removeNote", ({ params }) =>
      Effect.flatMap(CollabService, (s) => s.removeNote(params.id)).pipe(
        Effect.as(ok)
      )
    )
    .handle("addBookmark", ({ payload }) =>
      Effect.flatMap(CollabService, (s) =>
        s.addBookmark(payload.kind, payload.targetId, payload.label ?? "")
      )
    )
    .handle("removeBookmark", ({ params }) =>
      Effect.flatMap(targetKind(params.kind), (kind) =>
        Effect.flatMap(CollabService, (s) =>
          s.removeBookmark(kind, params.targetId)
        )
      ).pipe(Effect.as(ok))
    )
);
