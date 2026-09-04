import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import type {
  CloudSettingsRepo,
  StoredCloudConnection,
} from "./cloud.repository.ts";

export const makeMemoryCloudSettingsRepository = (
  seed: StoredCloudConnection | null = null
) =>
  Effect.gen(function* () {
    const store = yield* Ref.make<StoredCloudConnection | null>(seed);
    const repo: CloudSettingsRepo = {
      read: Ref.get(store),
      write: (connection) => Effect.as(Ref.set(store, connection), connection),
      clear: Ref.set(store, null),
    };
    return repo;
  });
