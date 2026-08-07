import * as Layer from "effect/Layer";
import {
  PlanSources,
  PlansRepository,
  PlansService,
  makePlansService,
} from "@byconvo/core/plans";
import {
  makeFilePlanSources,
  makeFilePlansRepository,
} from "./plans.repository.file.ts";

const SourcesLive = Layer.effect(PlanSources)(makeFilePlanSources);

export const PlansLive = Layer.effect(PlansService)(makePlansService).pipe(
  Layer.provide(
    Layer.effect(PlansRepository)(makeFilePlansRepository).pipe(
      Layer.provideMerge(SourcesLive)
    )
  )
);
