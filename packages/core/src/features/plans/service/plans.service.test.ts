import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { PlansMemory } from "../layer/plans.layer.memory.ts";
import { PlansService, type PlansServiceShape } from "./plans.service.ts";
import type { NewPlan } from "../schema/plans.schema.ts";

const BRANCH_FILE = [
  "export const createBranch = (name: string) => {",
  "  assertValidRef(name)",
  "  return git('branch', name)",
  "}",
].join("\n");

const files = { "src/branch.ts": BRANCH_FILE };

const analysis: NewPlan = {
  title: "How a branch is created",
  question: "analyse how a new branch is created",
  nodes: [
    { id: "ui", label: "New branch button", layer: "frontend", kind: "ui" },
    {
      id: "svc",
      label: "createBranch",
      layer: "backend",
      kind: "service",
      anchor: { filePath: "src/branch.ts", line: 2 },
    },
  ],
  edges: [{ from: "ui", to: "svc", label: "POST /branches" }],
  annotations: [
    {
      nodeId: "svc",
      body: "the ref name is validated before git ever sees it",
      anchor: { filePath: "src/branch.ts", line: 2 },
    },
  ],
};

const withPlan = <A, E>(
  use: (plans: PlansServiceShape, id: string) => Effect.Effect<A, E>,
  overrides: Readonly<Record<string, string>> = files
) =>
  Effect.gen(function* () {
    const plans = yield* PlansService;
    const created = yield* plans.create(analysis);
    return yield* use(plans, created.id);
  }).pipe(Effect.provide(PlansMemory([], overrides)));

/**
 * The analysis as it was recorded, viewed against a working tree that has since
 * moved on — the plan is built from `files` and then seeded into a second store
 * stocked with `changed`, which is what an old analysis loaded today amounts to.
 */
const viewAgainst = (changed: Readonly<Record<string, string>>) =>
  Effect.gen(function* () {
    const created = yield* Effect.gen(function* () {
      const plans = yield* PlansService;
      return yield* plans.create(analysis);
    }).pipe(Effect.provide(PlansMemory([], files)));

    return yield* Effect.gen(function* () {
      const plans = yield* PlansService;
      return yield* plans.view(created.id);
    }).pipe(Effect.provide(PlansMemory([created], changed)));
  });

describe("PlansService", () => {
  it.effect("stores an analysis and lists it as a draft", () =>
    withPlan((plans, id) =>
      Effect.gen(function* () {
        const summaries = yield* plans.list;
        expect(summaries).toHaveLength(1);
        expect(summaries[0]).toMatchObject({
          id,
          title: "How a branch is created",
          nodeCount: 2,
          annotationCount: 1,
          savedAt: null,
        });
      })
    )
  );

  it.effect("reports a plan as fresh against the code it was made from", () =>
    withPlan((plans, id) =>
      Effect.gen(function* () {
        const { staleness } = yield* plans.view(id);
        expect(staleness.needsRerun).toBe(false);
        expect(staleness.fresh).toBe(2);
      })
    )
  );

  it.effect(
    "re-anchors after the file shifts, without asking for a rerun",
    () =>
      Effect.gen(function* () {
        const { staleness } = yield* viewAgainst({
          "src/branch.ts": `// header\n\n${BRANCH_FILE}`,
        });
        expect(staleness.relocated).toBe(2);
        expect(staleness.needsRerun).toBe(false);
        expect(staleness.anchors[0].line).toBe(4);
      })
  );

  it.effect("asks for a rerun once the anchored line is rewritten", () =>
    Effect.gen(function* () {
      const { staleness } = yield* viewAgainst({
        "src/branch.ts": BRANCH_FILE.replace(
          "  assertValidRef(name)",
          "  assertRef(name, { slashes: false })"
        ),
      });
      expect(staleness.lost).toBe(2);
      expect(staleness.needsRerun).toBe(true);
    })
  );

  it.effect("asks for a rerun once the anchored file is deleted", () =>
    withPlan(
      (plans, id) =>
        Effect.gen(function* () {
          const { staleness } = yield* plans.view(id);
          expect(staleness.missing).toBe(2);
          expect(staleness.needsRerun).toBe(true);
        }),
      {}
    )
  );

  it.effect("keeps a review note apart from the analysis's own", () =>
    withPlan((plans, id) =>
      Effect.gen(function* () {
        const updated = yield* plans.addAnnotation(id, {
          nodeId: "svc",
          body: "should this reject slashes?",
        });
        expect(updated.annotations.map((entry) => entry.origin)).toEqual([
          "analysis",
          "review",
        ]);
      })
    )
  );

  it.effect("clears the review notes when the analysis is saved", () =>
    withPlan((plans, id) =>
      Effect.gen(function* () {
        yield* plans.addAnnotation(id, { nodeId: "svc", body: "a question" });
        const saved = yield* plans.save(id);
        expect(saved.annotations).toHaveLength(1);
        expect(saved.annotations[0].origin).toBe("analysis");
        expect(saved.savedAt).not.toBeNull();
      })
    )
  );

  it.effect("removes a single review note without touching the graph", () =>
    withPlan((plans, id) =>
      Effect.gen(function* () {
        const withNote = yield* plans.addAnnotation(id, { body: "temporary" });
        const note = withNote.annotations[1];
        const after = yield* plans.removeAnnotation(id, note.id);
        expect(after.annotations).toHaveLength(1);
        expect(after.nodes).toHaveLength(2);
      })
    )
  );

  it.effect("fails on a plan that is not there", () =>
    Effect.gen(function* () {
      const plans = yield* PlansService;
      const result = yield* Effect.flip(plans.get("nope"));
      expect(result._tag).toBe("NotFound");
    }).pipe(Effect.provide(PlansMemory([], files)))
  );
});
