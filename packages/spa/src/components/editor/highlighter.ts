import {
  getFiletypeFromFileName,
  getHighlighterOptions,
  preloadHighlighter,
  type FileContents,
} from "@pierre/diffs";
import { useWorkerPool } from "@pierre/diffs/react";
import { useEffect, useState } from "react";
import { contentCacheKey } from "@/lib/highlight-cache-key";

/** Shiki theme pair shared by every `@pierre/diffs` view in the app. */
export const THEMES = { light: "github-light", dark: "github-dark" } as const;

// Languages whose Shiki grammar has finished loading into the main-thread
// highlighter, shared across views so one load benefits the others.
const readyLangs = new Set<string>();

/**
 * Gate mounting an *editable* `@pierre/diffs` view on its grammar being
 * attached to the main-thread highlighter.
 *
 * Only editing needs this. The editor snapshots the rendered code when it
 * attaches, so a worker highlight landing afterwards would never reach it —
 * hence `disableWorkerPool` while editing, and hence priming the grammar here
 * so the first paint is coloured. Reading is served by the worker pool
 * instead, so `enabled: false` never gates.
 */
export function useLangReady(path: string, enabled: boolean): boolean {
  const lang = getFiletypeFromFileName(path);
  const [ready, setReady] = useState(() => readyLangs.has(lang));
  useEffect(() => {
    if (!enabled || readyLangs.has(lang)) {
      setReady(readyLangs.has(lang));
      return;
    }
    setReady(false);
    let cancelled = false;
    const done = () => {
      readyLangs.add(lang);
      if (!cancelled) setReady(true);
    };
    void preloadHighlighter(
      getHighlighterOptions(lang, { theme: THEMES })
    ).then(done, done);
    return () => {
      cancelled = true;
    };
  }, [lang, enabled]);
  return !enabled || ready;
}

/** The file as the pool wants it: named, and keyed so its highlight is cached. */
export function fileForHighlighting(
  path: string,
  contents: string
): FileContents {
  return {
    name: path,
    contents,
    cacheKey: `${path}:${contentCacheKey(contents)}`,
  };
}

/**
 * Highlight `file` in the shared worker pool *before* it is mounted.
 *
 * A `File` reads the pool's AST cache synchronously as it hydrates, so a primed
 * file paints coloured on its first frame. Mounting it unprimed instead paints
 * plain and swaps in the highlight when the worker answers — the flash this
 * exists to remove. Already-cached files (anything reopened) never wait, and
 * neither does a pool that is missing or has failed: those fall back to the
 * paint-plain-then-highlight path rather than blocking on it.
 */
export function useHighlightPrimed(
  file: FileContents | null,
  enabled: boolean
): boolean {
  const pool = useWorkerPool();
  const [primed, setPrimed] = useState(false);
  const cached = file !== null && pool?.getFileResultCache(file) !== undefined;

  useEffect(() => {
    if (!enabled || file === null || pool === undefined) return;
    if (pool.getFileResultCache(file) !== undefined) {
      setPrimed(true);
      return;
    }
    setPrimed(false);
    let cancelled = false;
    const done = () => {
      if (!cancelled) setPrimed(true);
    };
    pool.primeFileHighlightCache(file).then(done, done);
    return () => {
      cancelled = true;
    };
  }, [pool, file, enabled]);

  return !enabled || file === null || pool === undefined || cached || primed;
}
