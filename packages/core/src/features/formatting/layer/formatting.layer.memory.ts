import * as Layer from "effect/Layer";
import {
  FormattingRepository,
  type FormattingRepo,
} from "../repository/formatting.repository.ts";
import {
  makeMemoryFormattingRepository,
  type MemoryFormattingSeed,
} from "../repository/formatting.repository.memory.ts";
import {
  FormattingService,
  makeFormattingService,
} from "../service/formatting.service.ts";

export const FormattingMemory = (
  seed: MemoryFormattingSeed = {}
): Layer.Layer<FormattingService> =>
  Layer.effect(FormattingService)(makeFormattingService).pipe(
    Layer.provide(
      Layer.effect(FormattingRepository)(makeMemoryFormattingRepository(seed))
    )
  );

/** Wrap a hand-built repository — used by tests that need failure behaviour. */
export const FormattingFrom = (
  repo: FormattingRepo
): Layer.Layer<FormattingService> =>
  Layer.effect(FormattingService)(makeFormattingService).pipe(
    Layer.provide(Layer.succeed(FormattingRepository)(repo))
  );
