/**
 * Every endpoint is one command over the bridge. The renderer decides what a
 * command means against the live `<webview>`; the shapes it answers with are the
 * schemas, so the only work here is asking, and decoding what comes back.
 */
import {
  BrowserUnavailable,
  type BrowserScreenshot,
  type BrowserSnapshot,
  type BrowserState,
  type ConsoleMessage,
} from "@byconvo/core/browser";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import { BrowserRuntime } from "./browser.runtime.ts";

const DISCONNECTED: BrowserState = {
  connected: false,
  url: "",
  title: "",
  loading: false,
};

/**
 * The renderer answers in the endpoint's own shape, but it is still a socket
 * frame — treat a reply that isn't an object as the pane misbehaving rather
 * than trusting it into a typed response.
 */
const expectShape = <A>(
  op: string,
  value: unknown
): Effect.Effect<A, BrowserUnavailable> =>
  typeof value === "object" && value !== null
    ? Effect.succeed(value as A)
    : Effect.fail(
        new BrowserUnavailable({ reason: `the browser sent no "${op}" result` })
      );

export const BrowserHandler = HttpApiBuilder.group(Api, "browser", (handlers) =>
  handlers
    // The one endpoint that answers rather than failing when nothing is open:
    // it exists to be asked before the others, so every way of having no pane —
    // none connected, none answering, one answering nonsense — is the same
    // `connected: false` rather than three different errors to handle.
    .handle("state", () =>
      Effect.gen(function* () {
        const runtime = yield* BrowserRuntime;
        if (!(yield* runtime.connected)) return DISCONNECTED;
        const state = yield* runtime
          .request("state")
          .pipe(
            Effect.catchTag("BrowserUnavailable", () => Effect.succeed(null))
          );
        return typeof state === "object" && state !== null
          ? (state as BrowserState)
          : DISCONNECTED;
      })
    )
    .handle("navigate", ({ payload }) =>
      Effect.gen(function* () {
        const runtime = yield* BrowserRuntime;
        const state = yield* runtime.request("navigate", { url: payload.url });
        return yield* expectShape<BrowserState>("navigate", state);
      })
    )
    .handle("snapshot", ({ query }) =>
      Effect.gen(function* () {
        const runtime = yield* BrowserRuntime;
        const snapshot = yield* runtime.request("snapshot", {
          selector: query.selector ?? null,
        });
        return yield* expectShape<BrowserSnapshot>("snapshot", snapshot);
      })
    )
    .handle("evaluate", ({ payload }) =>
      Effect.gen(function* () {
        const runtime = yield* BrowserRuntime;
        const result = yield* runtime.request("eval", {
          script: payload.script,
        });
        return yield* expectShape<{ json: string }>("eval", result);
      })
    )
    .handle("console", () =>
      Effect.gen(function* () {
        const runtime = yield* BrowserRuntime;
        const messages = yield* runtime.request("console");
        return Array.isArray(messages)
          ? (messages as ReadonlyArray<ConsoleMessage>)
          : yield* Effect.fail(
              new BrowserUnavailable({
                reason: "the browser sent no console messages",
              })
            );
      })
    )
    .handle("screenshot", () =>
      Effect.gen(function* () {
        const runtime = yield* BrowserRuntime;
        const shot = yield* runtime.request("screenshot");
        return yield* expectShape<BrowserScreenshot>("screenshot", shot);
      })
    )
);
