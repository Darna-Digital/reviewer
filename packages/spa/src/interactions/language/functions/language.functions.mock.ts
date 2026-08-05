import type {
  Diagnostic,
  HoverResult,
  Position,
  SymbolReference,
  SymbolTarget,
} from "@byconvo/core/language";
import type { LanguageDependencies } from "../interfaces/language.interfaces";

export const range = (
  line: number,
  character: number,
  endLine = line,
  endCharacter = character + 1
) => ({
  start: { line, character },
  end: { line: endLine, character: endCharacter },
});

export const diagnostic = (over: Partial<Diagnostic> = {}): Diagnostic => ({
  range: range(0, 0),
  severity: "error",
  code: "2322",
  source: "ts",
  message: "Type 'string' is not assignable to type 'number'.",
  tags: [],
  related: [],
  ...over,
});

export const target = (over: Partial<SymbolTarget> = {}): SymbolTarget => ({
  location: { path: "src/a.ts", range: range(4, 16, 4, 21) },
  name: "greet",
  kind: "function",
  containerName: "",
  preview: "export function greet(name: string) {",
  ...over,
});

export const reference = (
  over: Partial<SymbolReference> = {}
): SymbolReference => ({
  location: { path: "src/b.ts", range: range(2, 8, 2, 13) },
  kind: "read",
  preview: 'greet("bob")',
  ...over,
});

export interface MockLanguageSeed {
  readonly diagnostics?: ReadonlyArray<Diagnostic>;
  readonly targets?: ReadonlyArray<SymbolTarget>;
  readonly references?: ReadonlyArray<SymbolReference>;
  readonly symbol?: string | null;
  readonly hover?: HoverResult;
}

export function mockLanguageDependencies(seed: MockLanguageSeed = {}) {
  const calls = {
    definition: [] as Array<{ path: string; position: Position }>,
    references: [] as Array<{ path: string; position: Position }>,
    hover: [] as Array<{ path: string; position: Position }>,
  };

  const deps: LanguageDependencies = {
    data: { diagnostics: seed.diagnostics ?? [] },
    sideEffects: {
      definition: async (path, position) => {
        calls.definition.push({ path, position });
        return { targets: seed.targets ?? [] };
      },
      references: async (path, position) => {
        calls.references.push({ path, position });
        return {
          symbol: seed.symbol === undefined ? "greet" : seed.symbol,
          references: seed.references ?? [],
        };
      },
      hover: async (path, position) => {
        calls.hover.push({ path, position });
        return (
          seed.hover ?? {
            providerId: "typescript",
            range: null,
            contents: "```ts\nconst a: number\n```",
          }
        );
      },
    },
  };

  return { deps, calls };
}
