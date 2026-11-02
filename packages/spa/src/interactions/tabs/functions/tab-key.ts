/**
 * A tab's identity across a workspace: the file's path, qualified by the
 * repository it is in.
 *
 * A workspace holds several repositories, and its open-file strip is one
 * strip for all of them — `src/index.ts` of the API and of the web app are
 * two tabs, side by side. The strip's transitions only ever compare tabs by
 * a string, so the repository rides in that string: the root, the ASCII unit
 * separator, then the path. No real path holds that character, it sits
 * before the last `/` — so the name and icon a tab shows, read off the
 * path's end, are the file's own — and unlike NUL, which `CSS.escape` turns
 * into U+FFFD, it survives the selector the strip finds its active tab by. A
 * tab with no repository is a bare path, which is what a strip saved before
 * workspaces held.
 */
const SEPARATOR = "\u001f";

export interface TabFile {
  /** The repository's root, or null for a tab saved before workspaces. */
  readonly repo: string | null;
  /** Repository-relative path. */
  readonly path: string;
}

export const tabKey = (repo: string | null, path: string): string =>
  repo === null ? path : `${repo}${SEPARATOR}${path}`;

export const tabFile = (key: string): TabFile => {
  const at = key.indexOf(SEPARATOR);
  return at === -1
    ? { repo: null, path: key }
    : { repo: key.slice(0, at), path: key.slice(at + SEPARATOR.length) };
};

/** A key saved before workspaces, given the repository its strip was of. */
export const adoptTabKey = (key: string, repo: string | null): string =>
  tabFile(key).repo === null ? tabKey(repo, key) : key;
