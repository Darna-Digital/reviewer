import * as Effect from "effect/Effect";
import type { CloudSettingsRepo } from "@reviewer/core/cloud";
import { StorageError } from "@reviewer/core/shared";
import {
  clearCloudConnection,
  readCloudConnection,
  writeCloudConnection,
} from "./cloud.store.ts";

/** Synchronous SQLite work; anything thrown is a storage failure. */
const attempt = <A>(f: () => A): Effect.Effect<A, StorageError> =>
  Effect.try({
    try: f,
    catch: (error) =>
      new StorageError({
        reason: error instanceof Error ? error.message : String(error),
      }),
  });

export const makeSqliteCloudSettingsRepository = Effect.sync(
  (): CloudSettingsRepo => ({
    read: attempt(readCloudConnection),
    write: (connection) =>
      attempt(() => {
        writeCloudConnection(connection);
        return connection;
      }),
    clear: attempt(clearCloudConnection),
  })
);
