/**
 * File-backed store for analyses — one JSON document per plan under
 * `.byconvo/plans/`, rather than one array file the way comments are kept.
 *
 * A plan is a document a human reads and an agent rewrites; a directory keeps
 * each one's history its own, so a saved analysis diffs as itself instead of as
 * a hunk in the middle of every other analysis.
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { NotFound, StorageError } from "@byconvo/core/shared";
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
import { WorkspaceContext } from "../workspace/workspace-context.ts";

const plansDir = (repoPath: string) => `${repoPath}/.byconvo/plans`;

/**
 * Plan ids reach here straight off the URL, so the filename is built from a
 * conservative slug rather than from the id itself — a `..` in a path segment
 * would otherwise be a way to name any file on the machine.
 */
const fileNameFor = (id: string) => `${id.replace(/[^a-zA-Z0-9_-]/g, "")}.json`;

const planPath = (repoPath: string, id: string) =>
  `${plansDir(repoPath)}/${fileNameFor(id)}`;

const decodePlan = Schema.decodeUnknownSync(Plan);

const readPlan = (repoPath: string, id: string): Plan | null => {
  try {
    return decodePlan(JSON.parse(readFileSync(planPath(repoPath, id), "utf8")));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const writePlan = (repoPath: string, plan: Plan) => {
  mkdirSync(plansDir(repoPath), { recursive: true });
  writeFileSync(
    planPath(repoPath, plan.id),
    `${JSON.stringify(plan, null, 2)}\n`
  );
};

const readAll = (repoPath: string): ReadonlyArray<Plan> => {
  let names: ReadonlyArray<string>;
  try {
    names = readdirSync(plansDir(repoPath));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return names
    .filter((name) => name.endsWith(".json"))
    .flatMap((name) => {
      // One unreadable document is not a reason for the picker to fail: an
      // analysis written by an older schema should drop out of the list, not
      // take the rest of them with it.
      try {
        const raw = readFileSync(`${plansDir(repoPath)}/${name}`, "utf8");
        return [decodePlan(JSON.parse(raw))];
      } catch {
        return [];
      }
    });
};

// Module-scoped so ids stay unique across the per-request repositories.
let counter = 0;

export const makeFilePlansRepository = Effect.gen(function* () {
  const ctx = yield* WorkspaceContext;
  const sources = yield* PlanSources;

  const withRepo = <A>(f: (repoPath: string) => A) =>
    Effect.flatMap(ctx.requireCurrent, (repoPath) =>
      Effect.try({
        try: () => f(repoPath),
        catch: (error) =>
          error instanceof NotFound
            ? error
            : new StorageError({
                reason: error instanceof Error ? error.message : String(error),
              }),
      })
    );

  const require = (id: string) =>
    withRepo((repoPath) => {
      const plan = readPlan(repoPath, id);
      if (plan === null) throw new NotFound({ reason: `plan ${id} not found` });
      return plan;
    });

  const update = (id: string, change: (plan: Plan) => Plan) =>
    Effect.flatMap(require(id), (plan) =>
      withRepo((repoPath) => {
        const next = change(plan);
        writePlan(repoPath, next);
        return next;
      })
    );

  const repo: PlansRepo = {
    list: withRepo((repoPath) =>
      readAll(repoPath)
        .map(summarizePlan)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    ),

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
          writePlan(repoPath, plan);
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

    remove: (id) =>
      withRepo((repoPath) => {
        rmSync(planPath(repoPath, id), { force: true });
      }),
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
