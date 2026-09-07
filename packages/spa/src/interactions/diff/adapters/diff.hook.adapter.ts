import { parsePatchFiles } from "@pierre/diffs";
import { useMemo } from "react";
import { contentCacheKey } from "@/lib/highlight-cache-key";
import { createDiffFunctions } from "../functions/diff.functions";

/** Wires the real @pierre/diffs parser into the pure diff functions. */
export function useDiffFunctions() {
  return useMemo(
    () =>
      createDiffFunctions({
        data: { internalDir: ".reviewer" },
        sideEffects: {
          // The prefix is what keys each parsed file in the worker pool's AST
          // cache; without it every re-parse re-highlights the whole diff.
          parsePatch: (text) =>
            parsePatchFiles(text, contentCacheKey(text)).flatMap(
              (patch) => patch.files
            ),
        },
      }),
    []
  );
}
