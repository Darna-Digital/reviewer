import * as Schema from "effect/Schema";
import {
  NoRepoSelected,
  NotFound,
  Ok,
  StorageError,
} from "@reviewer/core/shared";
import {
  NewPlan,
  NewReviewAnnotation,
  Plan,
  PlanAnnotationParams,
  PlanIdParam,
  PlanSummary,
  PlanView,
} from "@reviewer/core/plans";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const errors = [NoRepoSelected, NotFound, StorageError] as const;

export class PlansApi extends HttpApiGroup.make("plans")
  .add(
    HttpApiEndpoint.get("list", "/plans", {
      success: Schema.Array(PlanSummary),
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("get", "/plans/:id", {
      params: PlanIdParam,
      success: PlanView,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("create", "/plans", {
      payload: NewPlan,
      success: Plan,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("save", "/plans/:id/save", {
      params: PlanIdParam,
      success: Plan,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("annotate", "/plans/:id/annotations", {
      params: PlanIdParam,
      payload: NewReviewAnnotation,
      success: Plan,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")(
      "removeAnnotation",
      "/plans/:id/annotations/:annotationId",
      {
        params: PlanAnnotationParams,
        success: Plan,
        error: errors,
      }
    )
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/plans/:id", {
      params: PlanIdParam,
      success: Ok,
      error: errors,
    })
  ) {}
