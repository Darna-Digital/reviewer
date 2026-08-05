/**
 * The repository's flat path list, read as a tree one level at a time — what a
 * path bar's dropdowns walk through.
 */

export interface FolderEntry {
  readonly name: string;
  readonly path: string;
  readonly isDirectory: boolean;
}

/** The immediate children of `dir` — `""` for the repository root. */
export function folderEntries(
  paths: ReadonlyArray<string>,
  dir: string
): ReadonlyArray<FolderEntry> {
  const prefix = dir === "" ? "" : `${dir}/`;
  const directories = new Set<string>();
  const files = new Set<string>();
  for (const path of paths) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    if (rest === "") continue;
    const slash = rest.indexOf("/");
    if (slash === -1) files.add(rest);
    else directories.add(rest.slice(0, slash));
  }
  const named = (isDirectory: boolean) => (name: string) => ({
    name,
    path: `${prefix}${name}`,
    isDirectory,
  });
  const byName = (a: FolderEntry, b: FolderEntry) =>
    a.name.localeCompare(b.name);
  return [
    [...directories].map(named(true)).sort(byName),
    [...files].map(named(false)).sort(byName),
  ].flat();
}

export interface PathSegment {
  readonly name: string;
  /** The folder this segment sits in — `""` at the repository root. */
  readonly parent: string;
  readonly path: string;
}

/** `"src/lib/utils.ts"` read left to right, each segment with its folder. */
export function pathSegments(path: string): ReadonlyArray<PathSegment> {
  const segments: PathSegment[] = [];
  let parent = "";
  for (const name of path.split("/").filter((segment) => segment !== "")) {
    const full = parent === "" ? name : `${parent}/${name}`;
    segments.push({ name, parent, path: full });
    parent = full;
  }
  return segments;
}
