/**
 * Shared Shiki worker pool for every `@pierre/diffs` surface (diff pane, file
 * viewer, editor, conflict resolver). Replicates the setup of Pierre's own
 * diffshub app: syntax highlighting runs off the main thread in a small,
 * device-sized pool of Web Workers, and highlighted ASTs live in an LRU cache
 * keyed by content + render options — so scrolling, view toggles, and
 * re-themes re-slice cached tokens instead of re-highlighting.
 *
 * Mount once above all diff/file views; the pool is a singleton, and the
 * provider is SSR-safe (no workers are created without a `window`).
 */
import { WorkerPoolContextProvider, useWorkerPool } from "@pierre/diffs/react";
import DiffsRenderWorker from "@pierre/diffs/worker/worker.js?worker";
import { useEffect, type ReactNode } from "react";
import type {
  WorkerInitializationRenderOptions,
  WorkerPoolOptions,
} from "@pierre/diffs/worker";
import { useCodeThemes } from "@/components/editor/highlighter";
import { codeThemesOf, readUiPrefs } from "@/lib/ui-prefs";

// diffshub sizes the pool to the device: leave a core for the main thread and
// cap at 3 — beyond that, extra workers mostly duplicate grammar/theme memory.
const poolSize =
  typeof navigator === "undefined"
    ? 1
    : Math.max(1, Math.min((navigator.hardwareConcurrency || 4) - 1, 3));

const poolOptions: WorkerPoolOptions = {
  workerFactory: () => new DiffsRenderWorker(),
  poolSize,
  totalASTLRUCacheSize: 100,
};

// Grammars pre-loaded into each worker at startup (diffshub preloads a curated
// set the same way). Anything else resolves lazily on first render of that
// file type, so this is a warm-up list, not a limit.
const highlighterOptions: WorkerInitializationRenderOptions = {
  // The pair the app opens on; a later choice reaches the pool through
  // `CodeThemeSync` below.
  theme: codeThemesOf(readUiPrefs()),
  // Wrap every token in its own element carrying its column. `File` derives
  // this from its own token handlers, but a worker-rendered view cannot see
  // them — the pool owns the render options — so the language layer's token
  // hooks and diagnostic underlines only work if it is set here.
  useTokenTransformer: true,
  langs: [
    "typescript",
    "tsx",
    "javascript",
    "jsx",
    "json",
    "css",
    "html",
    "markdown",
    "shellscript",
    "yaml",
  ],
};

export function DiffWorkerPoolProvider({ children }: { children: ReactNode }) {
  return (
    <WorkerPoolContextProvider
      poolOptions={poolOptions}
      highlighterOptions={highlighterOptions}
    >
      <CodeThemeSync />
      {children}
    </WorkerPoolContextProvider>
  );
}

/**
 * A theme chosen in settings reaches the pool here: the pool re-resolves the
 * pair, hands it to every worker, drops the ASTs it cached under the old one
 * and tells each mounted view to repaint. The token transformer is said
 * again because the pool's setter takes a whole option set, and would
 * otherwise fall back to the library's default of off (see above).
 */
function CodeThemeSync() {
  const pool = useWorkerPool();
  const themes = useCodeThemes();
  useEffect(() => {
    if (pool === undefined || themes === highlighterOptions.theme) return;
    void pool.setRenderOptions({ theme: themes, useTokenTransformer: true });
  }, [pool, themes]);
  return null;
}
