import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import { NotFound } from "../../../shared.ts";
import {
  buildPlan,
  makeAnchor,
  saveAnalysis,
  summarizePlan,
} from "../functions/plans.functions.ts";
import type {
  NewPlan,
  NewPlanAnchor,
  NewReviewAnnotation,
  Plan,
  PlanAnchor,
} from "../schema/plans.schema.ts";
import { PlanSources, type PlansRepo } from "./plans.repository.ts";

const MEMORY_NOW = "2026-01-01T00:00:00.000Z";

/** Every path an incoming analysis wants anchored. */
export const requestedPaths = (input: {
  nodes: NewPlan["nodes"];
  annotations?: NewPlan["annotations"];
}): ReadonlyArray<string> => [
  ...new Set(
    [
      ...input.nodes.map((node) => node.anchor),
      ...(input.annotations ?? []).map((annotation) => annotation.anchor),
    ].flatMap((anchor) =>
      anchor === null || anchor === undefined ? [] : [anchor.filePath]
    )
  ),
];

/**
 * Stamp a posted anchor with the file's current text. A file that cannot be
 * read still anchors — with an empty fingerprint, which no live file will ever
 * match, so it reads as stale on the very next check instead of silently
 * passing.
 */
export const anchorStamper =
  (contents: ReadonlyMap<string, string | null>) =>
  (anchor: NewPlanAnchor | null | undefined): PlanAnchor | null => {
    if (anchor === null || anchor === undefined) return null;
    const content = contents.get(anchor.filePath) ?? null;
    if (content === null) {
      return {
        filePath: anchor.filePath,
        line: anchor.line ?? null,
        snippet: "",
        fileHash: "",
      };
    }
    return makeAnchor(anchor.filePath, anchor.line ?? null, content);
  };

export const makeMemoryPlansRepository = (seed: ReadonlyArray<Plan> = []) =>
  Effect.gen(function* () {
    const sources = yield* PlanSources;
    const store = yield* Ref.make<ReadonlyArray<Plan>>([...seed]);
    let counter = 0;

    const require = (id: string) =>
      Effect.flatMap(Ref.get(store), (all) => {
        const found = all.find((plan) => plan.id === id);
        return found === undefined
          ? Effect.fail(new NotFound({ reason: `plan ${id} not found` }))
          : Effect.succeed(found);
      });

    const put = (plan: Plan) =>
      Ref.update(store, (all) =>
        all.map((entry) => (entry.id === plan.id ? plan : entry))
      ).pipe(Effect.as(plan));

    const create = (input: NewPlan) =>
      Effect.gen(function* () {
        const contents = yield* sources.read(requestedPaths(input));
        counter += 1;
        const plan = buildPlan({
          id: `plan-mem-${counter}`,
          input,
          now: MEMORY_NOW,
          author: "agent",
          anchorFor: anchorStamper(contents),
          annotationId: (index) => `pa-mem-${counter}-${index}`,
        });
        yield* Ref.update(store, (all) => [...all, plan]);
        return plan;
      });

    const addAnnotation = (id: string, input: NewReviewAnnotation) =>
      Effect.gen(function* () {
        const plan = yield* require(id);
        const contents = yield* sources.read(
          input.anchor === null || input.anchor === undefined
            ? []
            : [input.anchor.filePath]
        );
        counter += 1;
        return yield* put({
          ...plan,
          updatedAt: MEMORY_NOW,
          annotations: [
            ...plan.annotations,
            {
              id: `pa-mem-${counter}`,
              origin: "review",
              nodeId: input.nodeId ?? null,
              body: input.body,
              author: input.author ?? "you",
              createdAt: MEMORY_NOW,
              anchor: anchorStamper(contents)(input.anchor),
            },
          ],
        });
      });

    const repo: PlansRepo = {
      list: Effect.map(Ref.get(store), (all) => all.map(summarizePlan)),
      get: require,
      create,
      save: (id) =>
        Effect.flatMap(require(id), (plan) =>
          put(saveAnalysis(plan, MEMORY_NOW))
        ),
      addAnnotation,
      removeAnnotation: (id, annotationId) =>
        Effect.flatMap(require(id), (plan) =>
          put({
            ...plan,
            updatedAt: MEMORY_NOW,
            annotations: plan.annotations.filter(
              (annotation) => annotation.id !== annotationId
            ),
          })
        ),
      remove: (id) =>
        Ref.update(store, (all) => all.filter((plan) => plan.id !== id)),
    };
    return repo;
  });
