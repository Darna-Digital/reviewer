import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import { WorkspaceService } from "@byconvo/core/workspace";

const ok = { ok: true } as const;

export const WorkspaceHandler = HttpApiBuilder.group(
  Api,
  "workspace",
  (handlers) =>
    handlers
      .handle("info", () => Effect.flatMap(WorkspaceService, (s) => s.info))
      .handle("setCurrent", ({ payload }) =>
        Effect.flatMap(WorkspaceService, (s) => s.setCurrent(payload.path))
      )
      .handle("selectRepo", ({ payload }) =>
        Effect.flatMap(WorkspaceService, (s) => s.selectRepo(payload.path))
      )
      .handle("browse", ({ query }) =>
        Effect.flatMap(WorkspaceService, (s) => s.browse(query.path ?? null))
      )
      .handle("readFile", ({ query }) =>
        Effect.flatMap(WorkspaceService, (s) => s.readFile(query.path))
      )
      .handle("readFileBytes", ({ query }) =>
        Effect.flatMap(WorkspaceService, (s) => s.readFileBytes(query.path))
      )
      .handle("writeFile", ({ payload }) =>
        Effect.flatMap(WorkspaceService, (s) =>
          s.writeFile(payload.path, payload.contents)
        ).pipe(Effect.as(ok))
      )
      .handle("createPath", ({ payload }) =>
        Effect.flatMap(WorkspaceService, (s) =>
          s.createPath(payload.path, payload.kind)
        ).pipe(Effect.as(ok))
      )
      .handle("deleteFile", ({ query }) =>
        Effect.flatMap(WorkspaceService, (s) => s.deletePath(query.path)).pipe(
          Effect.as(ok)
        )
      )
      .handle("renameFile", ({ payload }) =>
        Effect.flatMap(WorkspaceService, (s) =>
          s.renamePath(payload.from, payload.to)
        ).pipe(Effect.as(ok))
      )
      .handle("copyFile", ({ payload }) =>
        Effect.flatMap(WorkspaceService, (s) =>
          s.copyPath(payload.from, payload.to)
        ).pipe(Effect.as(ok))
      )
      .handle("uploadFile", ({ payload }) =>
        Effect.flatMap(WorkspaceService, (s) =>
          s.uploadFile(payload.path, payload.base64)
        ).pipe(Effect.as(ok))
      )
      .handle("trashFile", ({ payload }) =>
        Effect.flatMap(WorkspaceService, (s) => s.trashPath(payload.path))
      )
      .handle("revealFile", ({ payload }) =>
        Effect.flatMap(WorkspaceService, (s) =>
          s.revealPath(payload.path)
        ).pipe(Effect.as(ok))
      )
);
