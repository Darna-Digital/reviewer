/**
 * The search itself, wired to the language API.
 *
 * A search is a query rather than a one-shot fetch, unlike the go-to-definition
 * call beside it in `language.hook.adapter`: its answer stays on screen for as
 * long as the reader wants it there, so leaving the tab and coming back has to
 * find the results still in hand rather than starting the language server over.
 * The search key is part of the cache key, which is what makes "rerun" mean
 * rerun — a fresh key has nothing cached and goes back to the server.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchClient } from "@/lib/api/client";
import type { ReferencesResult } from "@reviewer/core/language";
import type { UsageQuery } from "../interfaces/find-usages.interfaces";

/**
 * How long a set of results stays fresh. Long enough that stepping through a
 * tab and back is free; short enough that a search left open across an editing
 * session is re-asked rather than trusted.
 */
const USAGES_STALE_MS = 60_000;

export const requestUsages = async (
  query: UsageQuery
): Promise<ReferencesResult> => {
  const { data, error } = await fetchClient.GET("/api/language/references", {
    params: {
      query: {
        path: query.path,
        line: String(query.position.line),
        character: String(query.position.character),
      },
    },
  });
  if (error) {
    throw new Error(
      (error as { reason?: string }).reason ?? "could not find usages"
    );
  }
  return data;
};

/** The results of `query`, or an idle query when nothing has been asked yet. */
export const useUsages = (query: UsageQuery | null) =>
  useQuery({
    queryKey: [
      "language",
      "usages",
      query?.path ?? "",
      query?.position.line ?? 0,
      query?.position.character ?? 0,
      query?.key ?? 0,
    ],
    queryFn: () =>
      query === null
        ? Promise.reject(new Error("no search"))
        : requestUsages(query),
    enabled: query !== null,
    staleTime: USAGES_STALE_MS,
    // A repository with no provider for this file answers with an empty result,
    // not an error; anything that does fail here has failed for good.
    retry: false,
  });
