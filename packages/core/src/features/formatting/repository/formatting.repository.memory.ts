import * as Effect from "effect/Effect";
import type { FormattingRepo } from "./formatting.repository.ts";
import type { FormatterInfo } from "../schema/formatting.schema.ts";

export interface MemoryFormattingSeed {
  readonly formatter?: FormatterInfo;
  /** Formatted text keyed by path; a path with no entry comes back unchanged. */
  readonly formatted?: Readonly<Record<string, string>>;
}

const UNAVAILABLE: FormatterInfo = {
  id: "prettier",
  name: "Prettier",
  available: false,
  version: null,
  configPath: null,
  detail: "Prettier is not installed in this project",
};

export const makeMemoryFormattingRepository = (
  seed: MemoryFormattingSeed = {}
) =>
  Effect.sync(() => {
    const formatter = seed.formatter ?? UNAVAILABLE;
    const repo: FormattingRepo = {
      formatter: Effect.succeed(formatter),
      format: (path, contents) => {
        const next = seed.formatted?.[path];
        return Effect.succeed({
          path,
          formatterId: formatter.available ? formatter.id : null,
          changed: next !== undefined && next !== contents,
          contents: next ?? contents,
        });
      },
    };
    return repo;
  });
