/**
 * Wire shapes for the formatting feature.
 *
 * A format is a whole-document round trip rather than a set of edits: Prettier
 * reprints from its own AST and has no notion of which spans it touched, so the
 * client is handed the finished text and works out the smallest edit that turns
 * its buffer into it.
 */
import * as Schema from "effect/Schema";

export const FormatterInfo = Schema.Struct({
  /** Stable id of the formatter, e.g. `prettier`. */
  id: Schema.String,
  name: Schema.String,
  /** Whether the project's own formatter could be resolved and run. */
  available: Schema.Boolean,
  /** Version of the resolved module, null when there is none. */
  version: Schema.NullOr(Schema.String),
  /** Project-relative path of the configuration file that was found. */
  configPath: Schema.NullOr(Schema.String),
  /** What was found, or why nothing was — the line settings shows. */
  detail: Schema.String,
});
export type FormatterInfo = typeof FormatterInfo.Type;

/** The buffer to format, which is what the user is looking at. */
export const FormatPayload = Schema.Struct({
  path: Schema.String,
  contents: Schema.String,
});
export type FormatPayload = typeof FormatPayload.Type;

export const FormatResult = Schema.Struct({
  path: Schema.String,
  /** Null when no formatter claimed the file — not an error. */
  formatterId: Schema.NullOr(Schema.String),
  /** Whether the formatter changed anything. */
  changed: Schema.Boolean,
  /** The formatted document, or the input unchanged. */
  contents: Schema.String,
});
export type FormatResult = typeof FormatResult.Type;
