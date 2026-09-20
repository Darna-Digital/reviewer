/**
 * DevRuntime — the Effect-facing handle on the (non-Effect) DevProcessManager
 * singleton, so HTTP handlers can start/stop/query dev processes. The manager
 * owns the long-lived state; this service is a thin, synchronous bridge. The
 * implementation is parameterised over a manager so tests can inject a fake.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  devProcessManager,
  type DevProcessManager,
  type DevRunStatus,
} from "../terminal/dev-process-manager.ts";

export interface StartCommandInput {
  readonly commandId: string;
  readonly repoPath: string;
  readonly command: string;
}

export interface DevRuntimeShape {
  readonly start: (input: StartCommandInput) => Effect.Effect<DevRunStatus>;
  readonly stop: (commandId: string) => Effect.Effect<void>;
  /** Stop everything the repository runs. */
  readonly stopRepo: (repoPath: string) => Effect.Effect<void>;
  readonly status: (commandId: string) => Effect.Effect<DevRunStatus | null>;
}

export class DevRuntime extends Context.Service<DevRuntime, DevRuntimeShape>()(
  "DevRuntime"
) {}

export const fromManager = (manager: DevProcessManager): DevRuntimeShape => ({
  start: (input) => Effect.sync(() => manager.start(input)),
  stop: (commandId) => Effect.sync(() => manager.stop(commandId)),
  stopRepo: (repoPath) => Effect.sync(() => manager.stopRepo(repoPath)),
  status: (commandId) => Effect.sync(() => manager.get(commandId)),
});

/** Production runtime, bound to the shared process manager. */
export const DevRuntimeLive = Layer.effect(DevRuntime)(
  Effect.sync(() => DevRuntime.of(fromManager(devProcessManager)))
);

/** Test seam: a runtime bound to an explicit (e.g. fake-spawner) manager. */
export const devRuntimeLayer = (manager: DevProcessManager) =>
  Layer.effect(DevRuntime)(
    Effect.sync(() => DevRuntime.of(fromManager(manager)))
  );
