import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { StorageError } from "../../../shared.ts";
import { CloudPendingDevice, CloudViewer } from "../schema/cloud.schema.ts";

/**
 * The connection as the local store keeps it — the public `CloudConnection`
 * plus the two secrets it leaves out: the bearer token once granted, and the
 * device code while the grant is still being waited on.
 *
 * A Schema rather than an interface because the row is one JSON document
 * decoded through it, so the shape here is the one definition of what is on
 * disk.
 */
export const StoredCloudConnection = Schema.Struct({
  serverUrl: Schema.String,
  token: Schema.NullOr(Schema.String),
  pendingDeviceCode: Schema.NullOr(Schema.String),
  pending: Schema.NullOr(CloudPendingDevice),
  user: Schema.NullOr(CloudViewer),
  connectedAt: Schema.NullOr(Schema.String),
});
export type StoredCloudConnection = typeof StoredCloudConnection.Type;

export interface CloudSettingsRepo {
  /** Null when the app has never been pointed at a cloud. */
  readonly read: Effect.Effect<StoredCloudConnection | null, StorageError>;
  readonly write: (
    connection: StoredCloudConnection
  ) => Effect.Effect<StoredCloudConnection, StorageError>;
  readonly clear: Effect.Effect<void, StorageError>;
}

export class CloudSettingsRepository extends Context.Service<
  CloudSettingsRepository,
  CloudSettingsRepo
>()("CloudSettingsRepository") {}
