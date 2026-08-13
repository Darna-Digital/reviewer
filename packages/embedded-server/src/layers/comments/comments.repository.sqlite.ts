/**
 * SQLite-backed comment store — local review comments, scoped to the
 * repository they were left in.
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ReviewComment } from "@byconvo/core/comments";
import { NotFound } from "@byconvo/core/shared";
import { inRepo } from "../db/db.service.ts";
import { documentTable } from "../db/documents.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import type { CommentsRepo } from "@byconvo/core/comments";

export const comments = documentTable<ReviewComment>({
  table: "comment",
  sortColumn: "created_at",
  direction: "asc",
  decode: Schema.decodeUnknownSync(ReviewComment),
});

// Module-scoped so ids stay unique even though the repository is built per
// request (a request-scoped closure counter would reset and could collide).
let counter = 0;

export const makeSqliteCommentsRepository = Effect.gen(function* () {
  const ctx = yield* WorkspaceContext;
  const withRepo = inRepo(ctx);

  const list: CommentsRepo["list"] = withRepo((repoPath) =>
    comments.list(repoPath)
  );

  const add: CommentsRepo["add"] = (input) =>
    withRepo((repoPath) => {
      counter += 1;
      const created: ReviewComment = {
        ...input,
        id: `c-${Date.now().toString(36)}-${counter}`,
        createdAt: new Date().toISOString(),
        source: "local",
      };
      comments.put(repoPath, created.id, created.createdAt, created);
      return created;
    });

  const update: CommentsRepo["update"] = (id, input) =>
    withRepo((repoPath) => {
      const existing = comments.find(repoPath, id);
      if (existing === undefined) {
        throw new NotFound({ reason: `comment ${id} not found` });
      }
      const updated: ReviewComment = { ...existing, body: input.body };
      comments.put(repoPath, id, updated.createdAt, updated);
      return updated;
    });

  const remove: CommentsRepo["remove"] = (id) =>
    withRepo((repoPath) => comments.remove(repoPath, id));

  return { list, add, update, remove } satisfies CommentsRepo;
});
