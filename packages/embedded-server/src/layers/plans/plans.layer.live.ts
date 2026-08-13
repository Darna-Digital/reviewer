import * as Layer from "effect/Layer";
import {
  PlanSources,
  PlansRepository,
  PlansService,
  makePlansService,
} from "@byconvo/core/plans";
import {
  makeFilePlanSources,
  makeSqlitePlansRepository,
} from "./plans.repository.sqlite.ts";

const SourcesLive = Layer.effect(PlanSources)(makeFilePlanSources);

export const PlansLive = Layer.effect(PlansService)(makePlansService).pipe(
  Layer.provide(
    Layer.effect(PlansRepository)(makeSqlitePlansRepository).pipe(
      Layer.provideMerge(SourcesLive)
    )
  )
);
