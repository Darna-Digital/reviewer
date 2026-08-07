import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  PlanSources,
  PlansRepository,
} from "../repository/plans.repository.ts";
import { makeMemoryPlansRepository } from "../repository/plans.repository.memory.ts";
import { PlansService, makePlansService } from "../service/plans.service.ts";
import type { Plan } from "../schema/plans.schema.ts";

/** Working-tree stand-in: a map of path to contents, anything else deleted. */
export const PlanSourcesMemory = (
  files: Readonly<Record<string, string>> = {}
): Layer.Layer<PlanSources> =>
  Layer.succeed(PlanSources)(
    PlanSources.of({
      read: (paths) =>
        Effect.succeed(
          new Map(paths.map((path) => [path, files[path] ?? null]))
        ),
      readOne: (path) => Effect.succeed(files[path] ?? null),
    })
  );

export const PlansMemory = (
  seed: ReadonlyArray<Plan> = [],
  files: Readonly<Record<string, string>> = {}
) =>
  Layer.effect(PlansService)(makePlansService).pipe(
    Layer.provide(
      Layer.effect(PlansRepository)(makeMemoryPlansRepository(seed)).pipe(
        Layer.provideMerge(PlanSourcesMemory(files))
      )
    )
  );
