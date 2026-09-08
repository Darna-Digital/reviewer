import { parsePatchFiles, type FileDiffMetadata } from "@pierre/diffs";
import { useMemo } from "react";
import { contentCacheKey } from "@/lib/highlight-cache-key";
import { createDiffFunctions } from "../functions/diff.functions";

/**
 * How many patches' parsed files are kept alive so a re-parse gives them back.
 *
 * Only the patch on screen and the one it was showing a moment ago need to
 * survive; the rest is a parsed diff's worth of memory each, so the shelf is
 * short.
 */
const HELD_PATCHES = 3;

/**
 * Parse a patch into files, giving back the very objects an earlier parse of
 * the same text produced.
 *
 * Each file's cache key is derived from the patch text and the file's place in
 * it, and the renderer reads that key as the file's identity: two files sharing
 * one key are, to it, one file. It also holds the object it last laid out and
 * compares it by reference against the one it is about to draw. So a second
 * parse of a patch already on screen — which any round trip through the same
 * text produces, and a commit's refresh can produce — hands the renderer a
 * stranger wearing the identity of what it is holding, and it throws
 * ("rendered a different diff than its prepared layout") rather than draw a
 * layout measured for one file over the contents of another.
 *
 * Answering the same text with the same objects keeps the two notions of
 * sameness in step. Note the renderer edits these objects in place when it
 * hydrates a file's unchanged regions, so a held patch is deliberately the
 * hydrated one — that is the file as everything on screen already reads it.
 */
const parsedPatches = new Map<string, ReadonlyArray<FileDiffMetadata>>();

export const parsePatchStably = (
  text: string
): ReadonlyArray<FileDiffMetadata> => {
  const held = parsedPatches.get(text);
  if (held !== undefined) {
    parsedPatches.delete(text);
    parsedPatches.set(text, held);
    return held;
  }
  // The prefix is what keys each parsed file in the worker pool's AST cache;
  // without it every re-parse re-highlights the whole diff.
  const files = parsePatchFiles(text, contentCacheKey(text)).flatMap(
    (patch) => patch.files
  );
  parsedPatches.set(text, files);
  for (const oldest of parsedPatches.keys()) {
    if (parsedPatches.size <= HELD_PATCHES) break;
    parsedPatches.delete(oldest);
  }
  return files;
};

/** Wires the real @pierre/diffs parser into the pure diff functions. */
export function useDiffFunctions() {
  return useMemo(
    () =>
      createDiffFunctions({
        data: { internalDir: ".reviewer" },
        sideEffects: { parsePatch: parsePatchStably },
      }),
    []
  );
}
