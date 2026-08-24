import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { FormatError } from "../../../ports/formatter.ts";
import {
  FormattingFrom,
  FormattingMemory,
} from "../layer/formatting.layer.memory.ts";
import type { FormattingRepo } from "../repository/formatting.repository.ts";
import type { FormatterInfo } from "../schema/formatting.schema.ts";
import { FormattingService } from "./formatting.service.ts";

const prettier: FormatterInfo = {
  id: "prettier",
  name: "Prettier",
  available: true,
  version: "3.9.6",
  configPath: "prettier.config.js",
  detail: "v3.9.6 · prettier.config.js",
};

const seeded = FormattingMemory({
  formatter: prettier,
  formatted: { "src/a.ts": 'const a = "1";\n' },
});

describe("formatting service", () => {
  it.effect("reports the formatter the project configures", () =>
    Effect.gen(function* () {
      const service = yield* FormattingService;
      expect(yield* service.formatter).toEqual(prettier);
    }).pipe(Effect.provide(seeded))
  );

  it.effect("formats a file the formatter claims", () =>
    Effect.gen(function* () {
      const service = yield* FormattingService;
      const result = yield* service.format("src/a.ts", "const a = '1'");
      expect(result.contents).toBe('const a = "1";\n');
      expect(result.changed).toBe(true);
      expect(result.formatterId).toBe("prettier");
    }).pipe(Effect.provide(seeded))
  );

  it.effect("leaves a file no formatter claims alone", () =>
    Effect.gen(function* () {
      const service = yield* FormattingService;
      const result = yield* service.format("README.md", "# title");
      expect(result.contents).toBe("# title");
      expect(result.changed).toBe(false);
    }).pipe(Effect.provide(seeded))
  );

  it.effect("rejects a blank path rather than formatting nothing", () =>
    Effect.gen(function* () {
      const service = yield* FormattingService;
      const error = yield* Effect.flip(service.format("  ", "x"));
      expect(error).toBeInstanceOf(FormatError);
    }).pipe(Effect.provide(seeded))
  );

  /**
   * A formatter that reprints a file identically has not changed it, whatever
   * it says — the editor decides whether to touch the buffer on this flag.
   */
  it.effect("derives `changed` from the text, not from the backend", () =>
    Effect.gen(function* () {
      const service = yield* FormattingService;
      const result = yield* service.format("src/a.ts", "same");
      expect(result.changed).toBe(false);
    }).pipe(
      Effect.provide(
        FormattingFrom({
          formatter: Effect.succeed(prettier),
          format: (path, contents) =>
            Effect.succeed({
              path,
              formatterId: "prettier",
              changed: true,
              contents,
            }),
        } satisfies FormattingRepo)
      )
    )
  );
});
