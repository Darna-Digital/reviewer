import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { fetchClient } from "@/lib/api/client";
import {
  EMPTY_GREP_RESULTS,
  createSearchFunctions,
} from "../functions/search.functions";
import {
  NO_SHIFT_TAPS,
  isCommandChord,
  isGrepChord,
  isTypingTarget,
  nextShiftTap,
} from "../functions/shortcuts.functions";
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
      const { data, error } = await fetchClient.GET("/api/search", {
        params: {
          query: {
            q: query,
            case: options.caseSensitive ? "1" : "0",
            word: options.wholeWord ? "1" : "0",
            regex: options.regex ? "1" : "0",
            limit: String(MAX_MATCHES),
          },
        },
      });
      if (error !== undefined) throw error;
      return data ?? EMPTY_GREP_RESULTS;
    },
  },
});

/**
 * The repo-wide content search behind the dialog's text mode. The query is
 * debounced here rather than in the dialog so a keystroke never fires a request
 * on its own, and the previous results stay on screen while the next ones load —
 * the list would otherwise blink empty on every letter.
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

interface SearchShortcutHandlers {
  /** ⌘K — the command list. */
  readonly onOpenCommands: () => void;
  /** Shift, tapped twice — straight to the file search. */
  readonly onOpenFiles: () => void;
  /** ⌘⇧F — straight to the content search. */
  readonly onOpenText: () => void;
}

/**
 * Install the three global search gestures. Handlers are held in a ref so the
 * listener is attached once: re-subscribing on every render would drop the
 * half-finished double tap that lives in this closure.
 */
export function useSearchShortcuts(handlers: SearchShortcutHandlers) {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    let taps = NO_SHIFT_TAPS;

    const onKeyDown = (event: KeyboardEvent) => {
      // The chords work from anywhere, including a focused field; only the
      // Shift gesture has to keep out of the way of typing.
      const chorded = isCommandChord(event)
        ? latest.current.onOpenCommands
        : isGrepChord(event)
          ? latest.current.onOpenText
          : null;
      if (chorded !== null) {
        event.preventDefault();
        taps = NO_SHIFT_TAPS;
        chorded();
        return;
      }
      if (isTypingTarget(event.target)) {
        taps = NO_SHIFT_TAPS;
        return;
      }
      const outcome = nextShiftTap(taps, event, Date.now());
      taps = outcome.taps;
      if (outcome.doubleTapped) latest.current.onOpenFiles();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
