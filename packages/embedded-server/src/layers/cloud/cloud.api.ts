/**
 * HTTP surface of the cloud feature — the connection, and the cloud's runs
 * relayed through the local server so the SPA never holds the token.
 *
 * The run stream is not here: `GET /api/cloud/runs/:id/events` is a plain
 * Node request listener (see `cloud-events-proxy.ts`), since a server-sent
 * stream that lives as long as the run does is not a request/response.
 */
import * as Schema from "effect/Schema";
import {
  CloudConnection,
  CloudNotConnected,
  CloudRepo,
  CloudRunIdParam,
  CloudRunSnapshot,
  CloudRunSummary,
  ConnectCloud,
  NewCloudRun,
  SendCloudRunMessage,
} from "@byconvo/core/cloud";
import { CloudApiError } from "@byconvo/core/ports/cloud-api";
import { StorageError } from "@byconvo/core/shared";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const connectionErrors = [StorageError, CloudApiError] as const;
const errors = [StorageError, CloudApiError, CloudNotConnected] as const;

export class CloudApi extends HttpApiGroup.make("cloud")
  .add(
    HttpApiEndpoint.get("status", "/cloud/status", {
      success: CloudConnection,
      error: [StorageError],
    })
  )
  .add(
    HttpApiEndpoint.post("connect", "/cloud/connect", {
      payload: ConnectCloud,
      success: CloudConnection,
      error: connectionErrors,
    })
  )
  .add(
    HttpApiEndpoint.post("poll", "/cloud/poll", {
      success: CloudConnection,
      error: connectionErrors,
    })
  )
  .add(
    HttpApiEndpoint.post("disconnect", "/cloud/disconnect", {
      success: CloudConnection,
      error: [StorageError],
    })
  )
  .add(
    HttpApiEndpoint.get("repos", "/cloud/repos", {
      success: Schema.Array(CloudRepo),
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("runs", "/cloud/runs", {
      success: Schema.Array(CloudRunSummary),
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("createRun", "/cloud/runs", {
      payload: NewCloudRun,
      success: CloudRunSnapshot,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("run", "/cloud/runs/:id", {
      params: CloudRunIdParam,
      success: CloudRunSnapshot,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("send", "/cloud/runs/:id/messages", {
      params: CloudRunIdParam,
      payload: SendCloudRunMessage,
      success: CloudRunSnapshot,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("cancel", "/cloud/runs/:id/cancel", {
      params: CloudRunIdParam,
      success: CloudRunSnapshot,
      error: errors,
    })
  ) {}
