import * as Schema from "effect/Schema";

export const BrowserState = Schema.Struct({
  /** Whether a window has the browser pane open and listening. */
  connected: Schema.Boolean,
  url: Schema.String,
  title: Schema.String,
  loading: Schema.Boolean,
});
export type BrowserState = typeof BrowserState.Type;

export const NavigateInput = Schema.Struct({ url: Schema.String });
export type NavigateInput = typeof NavigateInput.Type;

export const SnapshotQuery = Schema.Struct({
  /** CSS selector to scope the snapshot to; the whole document when absent. */
  selector: Schema.optionalKey(Schema.String),
});
export type SnapshotQuery = typeof SnapshotQuery.Type;

export const BrowserSnapshot = Schema.Struct({
  url: Schema.String,
  title: Schema.String,
  selector: Schema.String,
  html: Schema.String,
  /** The subtree's visible text, collapsed — the shape without the markup. */
  text: Schema.String,
});
export type BrowserSnapshot = typeof BrowserSnapshot.Type;

export const EvalInput = Schema.Struct({ script: Schema.String });
export type EvalInput = typeof EvalInput.Type;

export const EvalResult = Schema.Struct({
  /** The value as JSON. `"undefined"` for an expression that returned none. */
  json: Schema.String,
});
export type EvalResult = typeof EvalResult.Type;

export const ConsoleMessage = Schema.Struct({
  level: Schema.String,
  message: Schema.String,
  source: Schema.String,
  line: Schema.Number,
});
export type ConsoleMessage = typeof ConsoleMessage.Type;

export const BrowserScreenshot = Schema.Struct({
  /** `data:image/png;base64,…`, the whole visible viewport. */
  dataUrl: Schema.String,
});
export type BrowserScreenshot = typeof BrowserScreenshot.Type;

/**
 * No window is listening, or the one that is did not answer. Distinct from a
 * failed command: it means the human has not opened the pane, which an agent
 * should report rather than work around.
 */
export class BrowserUnavailable extends Schema.TaggedErrorClass<BrowserUnavailable>()(
  "BrowserUnavailable",
  { reason: Schema.String },
  { httpApiStatus: 503 }
) {
  override get message(): string {
    return this.reason;
  }
}
