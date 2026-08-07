import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import {
  checkPlanStaleness,
  planAnchorPaths,
} from "../functions/plans.functions.ts";
import {
  PlanSources,
  PlansRepository,
  type PlansFailure,
  type PlansRepo,
} from "../repository/plans.repository.ts";
import type { PlanView } from "../schema/plans.schema.ts";

/**
 * The store, plus the one thing a caller cannot do for itself: read a plan back
 * *and* say how much of it the working tree still agrees with.
 */
export interface PlansServiceShape extends PlansRepo {
  readonly view: (id: string) => Effect.Effect<PlanView, PlansFailure>;
}

export class PlansService extends Context.Service<
  PlansService,
  PlansServiceShape
>()("PlansService") {}

export const makePlansService = Effect.gen(function* () {
  const repo = yield* PlansRepository;
  const sources = yield* PlanSources;

  const view = (id: string) =>
    Effect.gen(function* () {
      const plan = yield* repo.get(id);
      const contents = yield* sources.read(planAnchorPaths(plan));
      return {
        plan,
        staleness: checkPlanStaleness(plan, contents, new Date().toISOString()),
      };
    });

  return PlansService.of({ ...repo, view });
});
