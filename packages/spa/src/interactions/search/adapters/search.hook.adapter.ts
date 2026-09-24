import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchClient } from "@/lib/api/client";
import {
  EMPTY_GREP_RESULTS,
  createSearchFunctions,
} from "../functions/search.functions";
import type { GrepOptions } from "../interfaces/search.interfaces";

/** One or two characters match most of the repository — wait for a real word. */
export const MIN_QUERY_LENGTH = 2;
/** Long enough that a typed word is one search, short enough to feel live. */
const DEBOUNCE_MS = 180;
const MAX_MATCHES = 500;

const searchFunctions = createSearchFunctions({
  data: { minQueryLength: MIN_QUERY_LENGTH },
  sideEffects: {
    grep: async (query, options) => {
      const params = {
        query: {
          q: query,
          case: options.caseSensitive ? "1" : "0",
          word: options.wholeWord ? "1" : "0",
          regex: options.regex ? "1" : "0",
          limit: String(MAX_MATCHES),
        },
      };
      const { data, error } = await fetchClient.GET("/api/search", { params });
      if (error !== undefined) throw error;
      return data ?? EMPTY_GREP_RESULTS;
    },
  },
});

/**
 * The content search behind the dialog's text mode, over the open repository.
 * The query is debounced here rather than in the dialog so a keystroke
 * never fires a request on its own, and the previous results stay on screen
 * while the next ones load — the list would otherwise blink empty on every
 * letter.
 *
 * `enabled` only stops new requests; the results already fetched stay put, so a
 * dismissed dialog animates out still showing what it found.
 */
export function useGrepSearch(
  query: string,
  options: GrepOptions,
  enabled = true
) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery({
    queryKey: ["grep", debounced, options],
    queryFn: () => searchFunctions.grep(debounced, options),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });
}
