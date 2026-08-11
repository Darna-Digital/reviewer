import type {
  ContentMatch,
  GrepOptions,
  GrepResults,
  SearchDependencies,
  SearchScope,
} from "../interfaces/search.interfaces";

export const contentMatch = (
  over: Partial<ContentMatch> = {}
): ContentMatch => ({
  path: "packages/spa/src/lib/queries.ts",
  line: 12,
  column: 14,
  text: 'export const useFiles = () => api.useQuery("get", "/api/files");',
  ...over,
});

export function mockSearchDependencies(results?: GrepResults) {
  const calls = {
    grep: [] as Array<{
      query: string;
      options: GrepOptions;
      scope: SearchScope;
    }>,
  };

  const deps: SearchDependencies = {
    data: { minQueryLength: 2 },
    sideEffects: {
      grep: async (query, options, scope) => {
        calls.grep.push({ query, options, scope });
        return results ?? { matches: [contentMatch()], truncated: false };
      },
    },
  };

  return { deps, calls };
}
