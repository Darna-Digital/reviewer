/**
 * HTTP surface of the formatting feature.
 *
 * Detection is a GET — settings asks the same question repeatedly and the
 * answer only changes when the project does. Formatting is a POST because it
 * carries the editor's buffer, which is what a save formats.
 */
import {
  FormatPayload,
  FormatResult,
  FormatterInfo,
} from "@byconvo/core/formatting";
import { FormatError } from "@byconvo/core/ports/formatter";
import { NoRepoSelected } from "@byconvo/core/shared";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const errors = [NoRepoSelected, FormatError] as const;

export class FormattingApi extends HttpApiGroup.make("formatting")
  .add(
    HttpApiEndpoint.get("formatter", "/formatting/formatter", {
      success: FormatterInfo,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("format", "/formatting/format", {
      payload: FormatPayload,
      success: FormatResult,
      error: errors,
    })
  ) {}
