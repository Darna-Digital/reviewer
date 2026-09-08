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
  const lang = filetypeOf(path);
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

/**
 * The Shiki grammar a path is read with — its own, unless we know better.
 *
 * `.env` resolves to the dotenv grammar but `.env.local` and friends fall back
 * to plain text, which leaves them flat on screen and, once the editor is
 * attached, commented with `//`. The filetype is what both the highlighter and
 * the editor's comment tokens key off, so it is settled in one place.
 */
export function filetypeOf(path: string): string {
  const filetype = getFiletypeFromFileName(path);
  if (filetype !== "text") return filetype;
  const name = path.slice(path.lastIndexOf("/") + 1);
  return /^\.?env(\..+)?$/i.test(name) ? "dotenv" : filetype;
}

/** The file as the pool wants it: named, and keyed so its highlight is cached. */
export function fileForHighlighting(
  path: string,
  contents: string
): FileContents {
  return {
    name: path,
    contents,
    lang: filetypeOf(path),
    cacheKey: `${path}:${contentCacheKey(contents)}`,
  };
}

/**
 * The file to hand the editable view, given the one it already has.
 *
 * The view treats every file it has not seen before as a replacement document:
 * it tears the edit session down and builds a new one around the incoming text.
 * That is right when the file really did change, and wrong when the read is
 * only the round trip of a save — which is what every ⌘S produces, since
 * writing the buffer refreshes git and the refresh re-reads the file. The
 * rebuild loses the caret and the undo history, and the virtualizer, whose
 * prepared layout still points at the session that just went away, throws
 * outright and takes the pane down with it.
 *
 * So a read that only says back what the editor is holding is not a new
 * document: the view keeps the file it has, and that file is brought up to date
 * in place. Updating it matters — it is the text a later change on disk is
 * merged against, and a file left at what it said before the save merges the
 * incoming change into text nobody is looking at any more.
 *
 * Anything else — a different path, text neither the view nor the editor is
 * showing — is a new document, and is built as one.
 */
export function externalFileFor(
  held: FileContents | null,
  path: string,
  contents: string,
  buffer: string | null
): FileContents {
  if (held === null || held.name !== path)
    return fileForHighlighting(path, contents);
  if (held.contents === contents) return held;
  if (buffer !== contents) return fileForHighlighting(path, contents);
  held.contents = contents;
  held.cacheKey = `${path}:${contentCacheKey(contents)}`;
  return held;
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
