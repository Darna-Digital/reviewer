import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { FormatError } from "../../../ports/formatter.ts";
import {
  FormattingRepository,
  type FormattingRepo,
} from "../repository/formatting.repository.ts";

/**
 * The formatting service — request validation and result normalisation around
 * whichever formatter the repository found.
 *
 * `changed` is recomputed from the two texts rather than taken on trust. It is
 * the flag the editor decides whether to touch the buffer on, and a formatter
 * that reprints a file byte-for-byte identically must not move the caret or
 * push an undo step for having done nothing.
 */
export interface FormattingServiceShape extends FormattingRepo {}

export class FormattingService extends Context.Service<
  FormattingService,
  FormattingServiceShape
>()("FormattingService") {}

const SERVICE_ID = "formatting";

const requirePath = (path: string): Effect.Effect<string, FormatError> => {
  const trimmed = path.trim();
  return trimmed.length === 0
    ? Effect.fail(
        new FormatError({
          formatterId: SERVICE_ID,
          reason: "a file path is required",
        })
      )
    : Effect.succeed(trimmed);
};

export const makeFormattingService = Effect.gen(function* () {
  const repo = yield* FormattingRepository;

  const service: FormattingServiceShape = {
    formatter: repo.formatter,

    format: (path, contents) =>
      requirePath(path).pipe(
        Effect.flatMap((valid) => repo.format(valid, contents)),
        Effect.map((result) => ({
          ...result,
          changed: result.contents !== contents,
        }))
      ),
  };

  return FormattingService.of(service);
});
