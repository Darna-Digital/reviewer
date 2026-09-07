/**
 * SQLite-backed store for visual comments — kept in their own table alongside
 * the inline review comments rather than mixed into them.
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { VisualComment } from "@reviewer/core/visual-comments";
import { NotFound } from "@reviewer/core/shared";
import { inRepo } from "../db/db.service.ts";
import { documentTable } from "../db/documents.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import type { VisualCommentsRepo } from "@reviewer/core/visual-comments";

export const visualComments = documentTable<VisualComment>({
  table: "visual_comment",
  sortColumn: "created_at",
  direction: "asc",
  decode: Schema.decodeUnknownSync(VisualComment),
});

// Module-scoped so ids stay unique even though the repository is built per
// request (a request-scoped closure counter would reset and could collide).
let counter = 0;

export const makeSqliteVisualCommentsRepository = Effect.gen(function* () {
  const ctx = yield* WorkspaceContext;
  const withRepo = inRepo(ctx);

  const list: VisualCommentsRepo["list"] = withRepo((repoPath) =>
    visualComments.list(repoPath)
  );

  const add: VisualCommentsRepo["add"] = (input) =>
    withRepo((repoPath) => {
      counter += 1;
      const created: VisualComment = {
        ...input,
        id: `v-${Date.now().toString(36)}-${counter}`,
        createdAt: new Date().toISOString(),
      };
      visualComments.put(repoPath, created.id, created.createdAt, created);
      return created;
    });

  const update: VisualCommentsRepo["update"] = (id, input) =>
    withRepo((repoPath) => {
      const existing = visualComments.find(repoPath, id);
      if (existing === undefined) {
        throw new NotFound({ reason: `visual comment ${id} not found` });
      }
      const updated: VisualComment = { ...existing, body: input.body };
      visualComments.put(repoPath, id, updated.createdAt, updated);
      return updated;
    });

  const remove: VisualCommentsRepo["remove"] = (id) =>
    withRepo((repoPath) => visualComments.remove(repoPath, id));

  return { list, add, update, remove } satisfies VisualCommentsRepo;
});
