import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
  NoRepoSelected,
  NotFound,
  StorageError,
} from "../../../shared.ts";
import type {
  NewPlan,
  NewReviewAnnotation,
  Plan,
  PlanSummary,
} from "../schema/plans.schema.ts";

export type PlansFailure = NoRepoSelected | NotFound | StorageError;

export interface PlansRepo {
  readonly list: Effect.Effect<ReadonlyArray<PlanSummary>, PlansFailure>;
  readonly get: (id: string) => Effect.Effect<Plan, PlansFailure>;
  readonly create: (input: NewPlan) => Effect.Effect<Plan, PlansFailure>;
  /** Freeze the analysis: review notes go, `savedAt` is stamped. */
  readonly save: (id: string) => Effect.Effect<Plan, PlansFailure>;
  readonly addAnnotation: (
    id: string,
    input: NewReviewAnnotation
  ) => Effect.Effect<Plan, PlansFailure>;
  readonly removeAnnotation: (
    id: string,
    annotationId: string
  ) => Effect.Effect<Plan, PlansFailure>;
  readonly remove: (id: string) => Effect.Effect<void, PlansFailure>;
}

export class PlansRepository extends Context.Service<
  PlansRepository,
  PlansRepo
>()("PlansRepository") {}

/**
 * Reading the files a plan's anchors point at — the other half of answering
 * "does this analysis still describe the code".
 *
 * Separate from the store because it is a different question asked of a
 * different place: the store owns `.reviewer/plans`, this reads the working tree.
 * A path that cannot be read comes back as null rather than as a failure — a
 * deleted file is an ordinary, expected finding here.
 */
export interface PlanSourcesShape {
  readonly read: (
    paths: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyMap<string, string | null>, PlansFailure>;
  /** One file's contents, for stamping a fresh anchor. */
  readonly readOne: (
    path: string
  ) => Effect.Effect<string | null, PlansFailure>;
}

export class PlanSources extends Context.Service<
  PlanSources,
  PlanSourcesShape
>()("PlanSources") {}
