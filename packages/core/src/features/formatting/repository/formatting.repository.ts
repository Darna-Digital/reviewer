import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { FormattingFailure } from "../../../ports/formatter.ts";
import type {
  FormatResult,
  FormatterInfo,
} from "../schema/formatting.schema.ts";

/**
 * The formatting backend as the service sees it: project-relative paths in,
 * formatted text out. The implementation owns finding the project's own
 * formatter and the absolute root the file falls in; neither leaks past this
 * boundary.
 */
export interface FormattingRepo {
  /** The project's formatter and whether it can run — settings reads this. */
  readonly formatter: Effect.Effect<FormatterInfo, FormattingFailure>;
  readonly format: (
    path: string,
    contents: string
  ) => Effect.Effect<FormatResult, FormattingFailure>;
}

export class FormattingRepository extends Context.Service<
  FormattingRepository,
  FormattingRepo
>()("FormattingRepository") {}
