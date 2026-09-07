/**
 * The cloud connection row — framework-free, like the chat and task stores,
 * because the SSE proxy reads it outside the Effect runtime while a request
 * is already on the wire.
 */
import * as Schema from "effect/Schema";
import { StoredCloudConnection } from "@reviewer/core/cloud";
import { execute, oneRow } from "../db/database.ts";

const decode = Schema.decodeUnknownSync(StoredCloudConnection);

/** The stored connection, or null when the app was never pointed at a cloud. */
export const readCloudConnection = (): StoredCloudConnection | null => {
  const row = oneRow<{ data: string }>(
    "SELECT data FROM cloud_connection WHERE id = 1"
  );
  if (row === undefined) return null;
  try {
    return decode(JSON.parse(row.data));
  } catch {
    // A row an older build wrote in a shape this one cannot read is the same
    // as no connection: the person reconnects rather than the app failing.
    return null;
  }
};

export const writeCloudConnection = (
  connection: StoredCloudConnection
): void => {
  execute(
    `INSERT INTO cloud_connection (id, data) VALUES (1, ?)
     ON CONFLICT (id) DO UPDATE SET data = excluded.data`,
    JSON.stringify(connection)
  );
};

export const clearCloudConnection = (): void => {
  execute("DELETE FROM cloud_connection WHERE id = 1");
};
