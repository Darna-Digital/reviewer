/**
 * Rendering a file's syntax before it is navigated to.
 *
 * Opening a file used to begin at the click: read the file, then highlight it,
 * with a loader standing in for both. Neither has to wait for the click. The
 * read goes into the query cache the viewer reads from, and the highlight into
 * the worker pool's AST cache, which a `File` consults synchronously as it
 * hydrates — so a file prerendered here paints coloured on its first frame,
 * and the loader is left for the file nobody saw coming.
 *
 * What is prerendered is what is about to be opened: the row the pointer is
 * over, the tab it is over, and every open tab while the window is idle. Each
 * is asked for once; the caches answer the repeats.
 */
import { useWorkerPool } from "@pierre/diffs/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { isEditablePath } from "@/components/editor/editable-path";
import {
  fileForHighlighting,
  isHighlightable,
} from "@/components/editor/highlighter";
import { isImagePath } from "@/components/editor/image-view";
import { fileQueryOptions } from "@/lib/queries";

export function usePrerenderFile(): (path: string) => void {
  const queryClient = useQueryClient();
  const pool = useWorkerPool();
  return useCallback(
    (path: string) => {
      // An image is bytes, not text, and an editable file renders off the
      // main-thread highlighter rather than the pool — see `CodeView`.
      if (isImagePath(path) || isEditablePath(path)) return;
      void queryClient
        .ensureQueryData(fileQueryOptions(path))
        .then((file) => {
          if (file.binary || pool === undefined) return;
          const highlightFile = fileForHighlighting(path, file.contents);
          if (
            !isHighlightable(highlightFile) ||
            pool.getFileResultCache(highlightFile) !== undefined
          )
            return;
          return pool.primeFileHighlightCache(highlightFile);
        })
        // A read or highlight that fails here fails again, visibly, on the
        // click — the prerender has nothing to say about it.
        .catch(() => {});
    },
    [queryClient, pool]
  );
}
