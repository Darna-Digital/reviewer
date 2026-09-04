/**
 * A unified diff, rebuilt out of the per-file patches a forge hands back.
 *
 * Neither forge always gives us a whole diff. GitHub's `.diff` media type
 * refuses any pull request over 20000 lines (406 `too_large`) and answers the
 * same change as paginated file entries instead; GitLab has no whole-diff
 * endpoint at all for a merge request and only ever lists the files with their
 * hunks. Both leave out the `diff --git` headers a diff parser needs, so both
 * are stitched back into one text here — once, for both, because the shape of
 * a git diff has nothing to do with whose API the pieces arrived from.
 */

export interface FileDiff {
  /** The path before the change — the same as `path` unless it was renamed. */
  readonly previousPath: string;
  readonly path: string;
  readonly status: "added" | "removed" | "renamed" | "modified";
  /** The file's hunks. Absent for a binary file, or one with no text change. */
  readonly patch?: string;
}

const REGULAR_FILE_MODE = "100644";

const renameLines = (file: FileDiff): Array<string> =>
  file.status !== "renamed"
    ? []
    : [
        // Parsers only read this line to tell a pure rename from a rename with
        // edits; neither forge reports the real percentage.
        file.patch === undefined
          ? "similarity index 100%"
          : "similarity index 99%",
        `rename from ${file.previousPath}`,
        `rename to ${file.path}`,
      ];

const fileDiff = (file: FileDiff): string => {
  const added = file.status === "added";
  const removed = file.status === "removed";
  return [
    `diff --git a/${file.previousPath} b/${file.path}`,
    ...(added ? [`new file mode ${REGULAR_FILE_MODE}`] : []),
    ...(removed ? [`deleted file mode ${REGULAR_FILE_MODE}`] : []),
    ...renameLines(file),
    added ? "--- /dev/null" : `--- a/${file.previousPath}`,
    removed ? "+++ /dev/null" : `+++ b/${file.path}`,
    ...(file.patch === undefined ? [] : [file.patch]),
  ].join("\n");
};

export const unifiedDiff = (files: ReadonlyArray<FileDiff>): string =>
  files.length === 0 ? "" : files.map(fileDiff).join("\n") + "\n";
