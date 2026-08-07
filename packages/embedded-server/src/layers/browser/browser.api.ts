/**
 * The browser pane as an API — what an agent session calls to drive the window's
 * browser and read what it renders. Every endpoint but `state` fails with
 * BrowserUnavailable when no pane is open; `state` answers `connected: false`
 * instead, so checking is cheap and never an error.
 */
import {
  BrowserScreenshot,
  BrowserSnapshot,
  BrowserState,
  BrowserUnavailable,
  ConsoleMessage,
  EvalInput,
  EvalResult,
  NavigateInput,
  SnapshotQuery,
} from "@byconvo/core/browser";
import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const errors = [BrowserUnavailable] as const;

export class BrowserApi extends HttpApiGroup.make("browser")
  .add(
    HttpApiEndpoint.get("state", "/browser/state", {
      success: BrowserState,
    })
  )
  .add(
    HttpApiEndpoint.post("navigate", "/browser/navigate", {
      payload: NavigateInput,
      success: BrowserState,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("snapshot", "/browser/snapshot", {
      query: SnapshotQuery,
      success: BrowserSnapshot,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("evaluate", "/browser/eval", {
      payload: EvalInput,
      success: EvalResult,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("console", "/browser/console", {
      success: Schema.Array(ConsoleMessage),
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("screenshot", "/browser/screenshot", {
      success: BrowserScreenshot,
      error: errors,
    })
  ) {}
