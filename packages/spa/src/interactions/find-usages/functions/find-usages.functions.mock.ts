import type { SymbolReference } from "@byconvo/core/language";
import type { FindUsagesDependencies } from "../interfaces/find-usages.interfaces";

export const at = (line: number, character = 0, length = 5) => ({
  start: { line, character },
  end: { line, character: character + length },
});

export const usage = (
  path: string,
  line: number,
  over: Partial<SymbolReference> = {}
): SymbolReference => ({
  location: { path, range: at(line) },
  kind: "read",
  preview: "greet(name)",
  containerName: "",
  containerKind: "",
  ...over,
});

export interface MockFindUsagesSeed {
  readonly references?: ReadonlyArray<SymbolReference>;
  readonly collapsed?: ReadonlyArray<string>;
  readonly declarationKind?: string;
}

export function mockFindUsagesDependencies(
  seed: MockFindUsagesSeed = {}
): FindUsagesDependencies {
  return {
    data: {
      references: seed.references ?? [],
      collapsed: new Set(seed.collapsed ?? []),
      declarationKind: seed.declarationKind ?? "",
    },
  };
}
