import * as Schema from "effect/Schema";
import {
  NoRepoSelected,
  NotFound,
  StorageError,
  Ok,
} from "@byconvo/core/shared";
import {
  DevCommand,
  DevCommandView,
  DevCommandIdParam,
  DevRepoScope,
  NewDevCommand,
  UpdateDevCommand,
} from "@byconvo/core/local-dev";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const errors = [NoRepoSelected, NotFound, StorageError] as const;

export class LocalDevApi extends HttpApiGroup.make("localDev")
  .add(
    HttpApiEndpoint.get("list", "/local-dev/commands", {
      success: Schema.Array(DevCommandView),
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("create", "/local-dev/commands", {
      payload: NewDevCommand,
      success: DevCommand,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("get", "/local-dev/commands/:id", {
      params: DevCommandIdParam,
      success: DevCommand,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("PATCH")("update", "/local-dev/commands/:id", {
      params: DevCommandIdParam,
      payload: UpdateDevCommand,
      success: DevCommand,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/local-dev/commands/:id", {
      params: DevCommandIdParam,
      success: Ok,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("start", "/local-dev/commands/:id/start", {
      params: DevCommandIdParam,
      success: DevCommandView,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("stop", "/local-dev/commands/:id/stop", {
      params: DevCommandIdParam,
      success: Ok,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("startAll", "/local-dev/start-all", {
      payload: DevRepoScope,
      success: Schema.Array(DevCommandView),
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("stopAll", "/local-dev/stop-all", {
      payload: DevRepoScope,
      success: Ok,
      error: errors,
    })
  ) {}
