/**
 * GitHub's paginated `pulls/:n/files` payload, read into the file patches
 * `unifiedDiff` stitches back into a diff. The `application/vnd.github.v3.diff`
 * media type refuses any PR whose diff exceeds 20000 lines (406 `too_large`),
 * while the files endpoint has no such cap — it just pages.
 */
import { unifiedDiff, type FileDiff } from "../reviews/unified-diff.ts";

export interface PullFileEntry {
  readonly filename: string;
  readonly status: string;
  readonly patch?: string;
  readonly previousFilename?: string;
}

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

/**
 * GitHub's own word for what happened to a file, in the four the diff builder
 * knows. Anything else it says — `changed`, `unchanged`, `copied` — is a file
 * that is still in both trees, which is what `modified` means here.
 */
const fileStatus = (entry: PullFileEntry): FileDiff["status"] => {
  if (entry.status === "added") return "added";
  if (entry.status === "removed") return "removed";
  return entry.previousFilename === undefined ? "modified" : "renamed";
};

export const diffFromPullFiles = (
  files: ReadonlyArray<PullFileEntry>
): string =>
  unifiedDiff(
    files.map((file): FileDiff => ({
      previousPath: file.previousFilename ?? file.filename,
      path: file.filename,
      status: fileStatus(file),
      ...(file.patch === undefined ? {} : { patch: file.patch }),
    }))
  );
