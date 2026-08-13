/**
 * SQLite-backed store for analyses.
 *
 * The file-backed version kept one JSON document per plan so a saved analysis
 * diffed as itself rather than as a hunk in the middle of every other one.
 * A row per plan keeps that property — and drops the part of it that was never
 * wanted: plan ids arrived straight off the URL and had to be scrubbed before
 * they could be turned into a filename. A bound parameter is not a path, so
 * there is nothing left to escape.
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { readFileSync } from "node:fs";
import { NotFound } from "@byconvo/core/shared";
import {
  Plan,
  PlanSources,
  anchorStamper,
  buildPlan,
  requestedPaths,
  saveAnalysis,
  summarizePlan,
} from "@byconvo/core/plans";
import type { PlanSourcesShape, PlansRepo } from "@byconvo/core/plans";
import { inRepo } from "../db/db.service.ts";
import { documentTable } from "../db/documents.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";

export const plans = documentTable<Plan>({
  table: "plan",
  sortColumn: "updated_at",
  direction: "desc",
  decode: Schema.decodeUnknownSync(Plan),
});

// Module-scoped so ids stay unique across the per-request repositories.
let counter = 0;

export const makeSqlitePlansRepository = Effect.gen(function* () {
  const ctx = yield* WorkspaceContext;
  const sources = yield* PlanSources;
  const withRepo = inRepo(ctx);

  const require = (id: string) =>
    withRepo((repoPath) => {
      const plan = plans.find(repoPath, id);
      if (plan === undefined) {
        throw new NotFound({ reason: `plan ${id} not found` });
      }
      return plan;
    });

  const update = (id: string, change: (plan: Plan) => Plan) =>
    Effect.flatMap(require(id), (plan) =>
      withRepo((repoPath) => {
        const next = change(plan);
        plans.put(repoPath, next.id, next.updatedAt, next);
        return next;
      })
    );

  const repo: PlansRepo = {
    list: withRepo((repoPath) => plans.list(repoPath).map(summarizePlan)),

    get: require,

    create: (input) =>
      Effect.gen(function* () {
        const contents = yield* sources.read(requestedPaths(input));
        const now = new Date().toISOString();
        counter += 1;
        const id = `plan-${Date.now().toString(36)}-${counter}`;
        const plan = buildPlan({
          id,
          input,
          now,
          author: "agent",
          anchorFor: anchorStamper(contents),
          annotationId: (index) => `${id}-a${index}`,
        });
        return yield* withRepo((repoPath) => {
          plans.put(repoPath, plan.id, plan.updatedAt, plan);
          return plan;
        });
      }),

    save: (id) =>
      update(id, (plan) => saveAnalysis(plan, new Date().toISOString())),

    addAnnotation: (id, input) =>
      Effect.gen(function* () {
        const contents = yield* sources.read(
          input.anchor === null || input.anchor === undefined
            ? []
            : [input.anchor.filePath]
        );
        const now = new Date().toISOString();
        counter += 1;
        return yield* update(id, (plan) => ({
          ...plan,
          updatedAt: now,
          annotations: [
            ...plan.annotations,
            {
              id: `${plan.id}-r${counter}`,
              origin: "review" as const,
              nodeId: input.nodeId ?? null,
              body: input.body,
              author: input.author ?? "you",
              createdAt: now,
              anchor: anchorStamper(contents)(input.anchor),
            },
          ],
        }));
      }),

    removeAnnotation: (id, annotationId) =>
      update(id, (plan) => ({
        ...plan,
        updatedAt: new Date().toISOString(),
        annotations: plan.annotations.filter(
          (annotation) => annotation.id !== annotationId
        ),
      })),

    remove: (id) => withRepo((repoPath) => plans.remove(repoPath, id)),
  };
  return repo;
});

/**
 * The working tree as the staleness check sees it. A path that resolves outside
 * the repository, or cannot be read at all, comes back as null — an analysis is
 * not a reason to read arbitrary files off the machine, and a deleted file is
 * an ordinary finding here rather than a failure.
 */
export const makeFilePlanSources = Effect.gen(function* () {
  const ctx = yield* WorkspaceContext;

  const readWithin = (repoPath: string, filePath: string): string | null => {
    const resolved = `${repoPath}/${filePath}`;
    if (filePath.startsWith("/") || filePath.split("/").includes("..")) {
      return null;
    }
    try {
      return readFileSync(resolved, "utf8");
    } catch {
      return null;
    }
  };

  const sources: PlanSourcesShape = {
    read: (paths) =>
      Effect.map(
        ctx.requireCurrent,
        (repoPath) =>
          new Map(paths.map((path) => [path, readWithin(repoPath, path)]))
      ),
    readOne: (path) =>
      Effect.map(ctx.requireCurrent, (repoPath) => readWithin(repoPath, path)),
  };
  return sources;
});
