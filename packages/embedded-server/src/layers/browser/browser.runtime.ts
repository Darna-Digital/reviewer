/**
 * BrowserRuntime — the Effect-facing handle on the (non-Effect) browser bridge
 * singleton, so HTTP handlers can drive the window's pane. Mirrors DevRuntime:
 * the singleton owns the socket, this service is a thin bridge, and it is
 * parameterised over a bridge so tests can inject a fake.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { BrowserUnavailable } from "@reviewer/core/browser";
import {
  browserBridge,
  type BrowserBridge,
  type BrowserOp,
} from "./browser-bridge.ts";

export interface BrowserRuntimeShape {
  readonly connected: Effect.Effect<boolean>;
  readonly request: (
    op: BrowserOp,
    payload?: unknown
  ) => Effect.Effect<unknown, BrowserUnavailable>;
}

export class BrowserRuntime extends Context.Service<
  BrowserRuntime,
  BrowserRuntimeShape
>()("BrowserRuntime") {}

export const fromBridge = (bridge: BrowserBridge): BrowserRuntimeShape => ({
  connected: Effect.sync(() => bridge.connected()),
  request: (op, payload) =>
    Effect.tryPromise({
      try: () => bridge.request(op, payload),
      catch: (cause) =>
        new BrowserUnavailable({
          reason: cause instanceof Error ? cause.message : String(cause),
        }),
    }),
});

export const BrowserRuntimeLive = Layer.effect(BrowserRuntime)(
  Effect.sync(() => BrowserRuntime.of(fromBridge(browserBridge)))
);

/** Test seam: a runtime bound to an explicit (e.g. in-memory) bridge. */
export const browserRuntimeLayer = (bridge: BrowserBridge) =>
  Layer.effect(BrowserRuntime)(
    Effect.sync(() => BrowserRuntime.of(fromBridge(bridge)))
  );
