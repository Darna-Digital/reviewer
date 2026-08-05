/**
 * Rebuilds a unified diff out of GitHub's paginated `pulls/:n/files` payload.
 * The `application/vnd.github.v3.diff` media type refuses any PR whose diff
 * exceeds 20000 lines (406 `too_large`), while the files endpoint has no such
 * cap — it just pages.
 */

export interface PullFileEntry {
  readonly filename: string;
  readonly status: string;
  readonly patch?: string;
  readonly previousFilename?: string;
}

const REGULAR_FILE_MODE = "100644";

export const parsePullFiles = (data: unknown): ReadonlyArray<PullFileEntry> => {
  if (!Array.isArray(data)) return [];
  return data.flatMap((raw: unknown): Array<PullFileEntry> => {
    const entry = raw as {
      filename?: unknown;
      status?: unknown;
      patch?: unknown;
      previous_filename?: unknown;
    };
    if (typeof entry.filename !== "string" || entry.filename.length === 0)
      return [];
    return [
      {
        filename: entry.filename,
        status: typeof entry.status === "string" ? entry.status : "modified",
        ...(typeof entry.patch === "string" ? { patch: entry.patch } : {}),
        ...(typeof entry.previous_filename === "string"
          ? { previousFilename: entry.previous_filename }
          : {}),
      },
    ];
  });
};

const renameLines = (file: PullFileEntry, previous: string): Array<string> =>
  file.previousFilename === undefined
    ? []
    : [
        // Parsers only read this line to tell a pure rename from a rename with
        // edits; GitHub does not report the real percentage.
        file.patch === undefined
          ? "similarity index 100%"
          : "similarity index 99%",
        `rename from ${previous}`,
        `rename to ${file.filename}`,
      ];

const fileDiff = (file: PullFileEntry): string => {
  const previous = file.previousFilename ?? file.filename;
  const added = file.status === "added";
  const removed = file.status === "removed";
  return [
    `diff --git a/${previous} b/${file.filename}`,
    ...(added ? [`new file mode ${REGULAR_FILE_MODE}`] : []),
    ...(removed ? [`deleted file mode ${REGULAR_FILE_MODE}`] : []),
    ...renameLines(file, previous),
    added ? "--- /dev/null" : `--- a/${previous}`,
    removed ? "+++ /dev/null" : `+++ b/${file.filename}`,
    ...(file.patch === undefined ? [] : [file.patch]),
  ].join("\n");
};

export const diffFromPullFiles = (
  files: ReadonlyArray<PullFileEntry>
): string => (files.length === 0 ? "" : files.map(fileDiff).join("\n") + "\n");
