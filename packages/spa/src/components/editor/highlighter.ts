import {
  getFiletypeFromFileName,
  getHighlighterOptions,
  preloadHighlighter,
} from "@pierre/diffs"
import { useEffect, useState } from "react"

/** Shiki theme pair shared by every `@pierre/diffs` view in the app. */
export const THEMES = { light: "github-light", dark: "github-dark" } as const

// Languages whose Shiki grammar has finished loading into the shared
// highlighter. `File`/`UnresolvedFile` only highlight cleanly when the grammar
// is attached at mount time, so we preload per language and remember what's
// ready — shared across every view so a preload in one benefits the others.
const readyLangs = new Set<string>()

/**
 * Gate mounting a `@pierre/diffs` view on its language grammar being loaded.
 * Returns `false` until the grammar for `path`'s filetype is attached; the view
 * would otherwise render unhighlighted and never re-highlight in place.
 */
export function useLangReady(path: string): boolean {
  const lang = getFiletypeFromFileName(path)
  const [ready, setReady] = useState(() => readyLangs.has(lang))
  useEffect(() => {
    if (readyLangs.has(lang)) {
      setReady(true)
      return
    }
    setReady(false)
    let cancelled = false
    const done = () => {
      readyLangs.add(lang)
      if (!cancelled) setReady(true)
    }
    void preloadHighlighter(
      getHighlighterOptions(lang, { theme: THEMES })
    ).then(done, done)
    return () => {
      cancelled = true
    }
  }, [lang])
  return ready
}
