/**
 * One diff across a workspace's repositories — your own changes in every root
 * at once, the way a JetBrains commit view lists each root that has some.
 *
 * Each root answers `/api/diff` for itself, with paths relative to it, and two
 * roots can both have changed `package.json`. The pane keys everything it
 * holds by a file's name — its items, expansions, comments, the selection —
 * so the names are made workspace-wide first: every path in a root's patch is
 * put under the root's key, the folder's name the native tree already stands
 * that root's rows under (`reviewer/packages/…`). The patches are then one
 * text, parsed once, and the pane reads it like any other diff; a name is
 * taken apart again only where something has to be asked of its repository.
 */

export interface WorkspaceDiffRoot {
  readonly path: string;
  readonly name: string;
}

/** A workspace-wide name taken apart: the repository and its own path. */
export interface WorkspaceFile {
  readonly root: string;
  readonly path: string;
}

/**
 * Each root's key by its path: the folder's name, numbered from the second
 * root that shares one — the same keys `SidebarTree.rootKeys` gives the
 * native tree, so a row's id and a file's name in the diff are one string.
 */
export function workspaceRootKeys(
  roots: ReadonlyArray<WorkspaceDiffRoot>
): ReadonlyMap<string, string> {
  const taken = new Map<string, number>();
  const keys = new Map<string, string>();
  for (const root of roots) {
    const seen = (taken.get(root.name) ?? 0) + 1;
    taken.set(root.name, seen);
    keys.set(root.path, seen === 1 ? root.name : `${root.name} ${seen}`);
  }
  return keys;
}

export const qualifiedName = (key: string, path: string): string =>
  `${key}/${path}`;

/** The repository and path a workspace-wide name stands for, if it is one. */
export function locateWorkspaceFile(
  name: string,
  rootsByKey: ReadonlyMap<string, string>
): WorkspaceFile | null {
  const slash = name.indexOf("/");
  if (slash === -1) return null;
  const root = rootsByKey.get(name.slice(0, slash));
  return root === undefined ? null : { root, path: name.slice(slash + 1) };
}

const GIT_DIFF_HEADER =
  /^diff --git ("a\/(?:[^"\\]|\\.)*"|a\/.+?) ("b\/(?:[^"\\]|\\.)*"|b\/.+?)$/;
const SIDE_PREFIX = /^[ab]\//;
const NAMED_LINES = ["rename from ", "rename to ", "copy from ", "copy to "];

/** `a/x`, `"b/x"` or a bare `x`, with the key put in front of the path. */
function qualifyToken(token: string, key: string, sided: boolean): string {
  const quoted = token.startsWith('"');
  const body = quoted ? token.slice(1) : token;
  const side = sided && SIDE_PREFIX.test(body) ? body.slice(0, 2) : "";
  const qualified = `${side}${qualifiedName(key, body.slice(side.length))}`;
  return quoted ? `"${qualified}` : qualified;
}

function qualifyHeaderLine(line: string, key: string): string {
  const files = GIT_DIFF_HEADER.exec(line);
  if (files !== null) {
    const [, from = "", to = ""] = files;
    return `diff --git ${qualifyToken(from, key, true)} ${qualifyToken(to, key, true)}`;
  }
  if (line.startsWith("--- ") || line.startsWith("+++ ")) {
    const file = line.slice(4);
    return file === "/dev/null"
      ? line
      : `${line.slice(0, 4)}${qualifyToken(file, key, true)}`;
  }
  const named = NAMED_LINES.find((prefix) => line.startsWith(prefix));
  return named === undefined
    ? line
    : `${named}${qualifyToken(line.slice(named.length), key, false)}`;
}

/**
 * A root's patch with every file it names put under `key`. Only the lines
 * between a file's `diff --git` and its first hunk are touched: a hunk's own
 * lines are code, and a removed line reading `-- a/x` is `--- a/x` in the
 * patch.
 */
export function qualifyPatch(text: string, key: string): string {
  let inHeader = false;
  return text
    .split("\n")
    .map((line) => {
      if (line.startsWith("diff --git ")) inHeader = true;
      else if (line.startsWith("@@ ")) inHeader = false;
      return inHeader ? qualifyHeaderLine(line, key) : line;
    })
    .join("\n");
}

/** Every root's patch, each under its key, as one text in the workspace's order. */
export function workspacePatch(
  patches: ReadonlyArray<{ readonly key: string; readonly text: string }>
): string {
  return patches
    .filter((patch) => patch.text.trim().length > 0)
    .map((patch) => {
      const qualified = qualifyPatch(patch.text, patch.key);
      return qualified.endsWith("\n") ? qualified : `${qualified}\n`;
    })
    .join("");
}
