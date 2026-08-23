import type { FormattingDependencies } from "../interfaces/formatting.interfaces";

export interface MockFormattingSeed {
  readonly enabled?: boolean;
  readonly available?: boolean;
  /** Formatted text keyed by path; a path with no entry comes back unchanged. */
  readonly formatted?: Readonly<Record<string, string>>;
  /** Fail every request with this reason instead of answering. */
  readonly failure?: string;
}

export function mockFormattingDependencies(seed: MockFormattingSeed = {}) {
  const calls = {
    format: [] as Array<{ path: string; contents: string }>,
    failures: [] as string[],
  };

  const deps: FormattingDependencies = {
    data: {
      enabled: seed.enabled ?? true,
      available: seed.available ?? true,
    },
    sideEffects: {
      format: async (path, contents) => {
        calls.format.push({ path, contents });
        if (seed.failure !== undefined) throw new Error(seed.failure);
        const next = seed.formatted?.[path] ?? contents;
        return { changed: next !== contents, contents: next };
      },
      onFailure: (reason) => calls.failures.push(reason),
    },
  };

  return { deps, calls };
}
