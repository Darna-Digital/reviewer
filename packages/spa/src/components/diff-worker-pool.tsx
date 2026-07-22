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
import { WorkerPoolContextProvider } from "@pierre/diffs/react"
import DiffsRenderWorker from "@pierre/diffs/worker/worker.js?worker"
import type { ReactNode } from "react"
import type {
  WorkerInitializationRenderOptions,
  WorkerPoolOptions,
} from "@pierre/diffs/worker"
import { THEMES } from "@/components/editor/highlighter"

// diffshub sizes the pool to the device: leave a core for the main thread and
// cap at 3 — beyond that, extra workers mostly duplicate grammar/theme memory.
const poolSize =
  typeof navigator === "undefined"
    ? 1
    : Math.max(1, Math.min((navigator.hardwareConcurrency || 4) - 1, 3))

const poolOptions: WorkerPoolOptions = {
  workerFactory: () => new DiffsRenderWorker(),
  poolSize,
  totalASTLRUCacheSize: 100,
}

// Grammars pre-loaded into each worker at startup (diffshub preloads a curated
// set the same way). Anything else resolves lazily on first render of that
// file type, so this is a warm-up list, not a limit.
const highlighterOptions: WorkerInitializationRenderOptions = {
  theme: THEMES,
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
}

export function DiffWorkerPoolProvider({ children }: { children: ReactNode }) {
  return (
    <WorkerPoolContextProvider
      poolOptions={poolOptions}
      highlighterOptions={highlighterOptions}
    >
      {children}
    </WorkerPoolContextProvider>
  )
}
