import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import { ProjectService } from "@byconvo/core/project";
import type { LogQuery } from "@byconvo/core/repo";

const trimmed = (value: string | undefined): string | null =>
  value !== undefined && value.trim().length > 0 ? value.trim() : null;

export const ProjectHandler = HttpApiBuilder.group(Api, "project", (handlers) =>
  handlers
    .handle("changes", () => Effect.flatMap(ProjectService, (s) => s.changes))
    .handle("files", () => Effect.flatMap(ProjectService, (s) => s.files))
    .handle("diff", () => Effect.flatMap(ProjectService, (s) => s.worktreeDiff))
    .handle("branches", () => Effect.flatMap(ProjectService, (s) => s.branches))
    .handle("commit", ({ payload }) =>
      Effect.flatMap(ProjectService, (s) =>
        s.commit(payload.message, payload.paths)
      )
    )
    .handle("log", ({ query }) => {
      // `ref` is deliberately ignored: a branch name belongs to one root, and
      // the project's history is every root's HEAD. The rest of the filters
      // (author, grep, dates, paths) mean the same thing in every root.
      const q: LogQuery = {
        ref: "HEAD",
        limit: Math.min(Number(query.limit ?? 150) || 150, 10_000),
        skip: Math.max(0, Number(query.skip ?? 0) || 0),
        author: trimmed(query.author),
        grep: trimmed(query.grep),
        regex: query.regex === "1",
        caseSensitive: query.case === "1",
        after: trimmed(query.after),
        before: trimmed(query.before),
        path: trimmed(query.path),
        follow: false,
      };
      return Effect.flatMap(ProjectService, (s) => s.log(q));
    })
);
