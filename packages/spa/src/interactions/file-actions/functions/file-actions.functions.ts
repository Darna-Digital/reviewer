import { errorReason } from "@/lib/errors";
import type {
  FileActionsDependencies,
  FileActionsFunctions,
  PathKind,
  TreeItem,
} from "../interfaces/file-actions.interfaces";

/** The tree writes directories as `src/`; the API takes plain repo paths. */
export const withoutTrailingSlash = (path: string): string =>
  path.endsWith("/") ? path.slice(0, -1) : path;

export const parentDirectory = (path: string): string => {
  const separator = withoutTrailingSlash(path).lastIndexOf("/");
  return separator < 0 ? "" : path.slice(0, separator);
};

/** Where a new entry goes when the menu was opened on `item`. */
export const targetDirectory = (item: TreeItem): string =>
  item.kind === "directory"
    ? withoutTrailingSlash(item.path)
    : parentDirectory(item.path);

// The draft is born blank and stays blank until the user types. The tree drops
// a rename that comes back blank, which is what "Enter, having named nothing"
// should do — where a pre-filled name would be committed as a no-op rename,
// leaving a row on screen that no file was ever created for. Widened rather
// than numbered when something is already there, so it stays blank.
const DRAFT_BASENAME = " ";

/**
 * The path a new row is drawn at while the user names it, in the tree's own
 * spelling (trailing slash for a folder) so it renders as the right kind of row.
 * `exists` is asked of the tree itself, which is a row ahead of the file list
 * while a rename is still on its way to the server.
 */
export const draftPath = (
  directory: string,
  kind: PathKind,
  exists: (path: string) => boolean
): string => {
  const prefix = directory === "" ? "" : `${directory}/`;
  let name = DRAFT_BASENAME;
  while (exists(`${prefix}${name}`)) name += DRAFT_BASENAME;
  return `${prefix}${name}${kind === "directory" ? "/" : ""}`;
};

export function createFileActionsFunctions(
  d: FileActionsDependencies
): FileActionsFunctions {
  const { create, notifyError, openFile, refresh, rememberFolder } =
    d.sideEffects;

  const createEntry: FileActionsFunctions["create"] = async (path, kind) => {
    const target = withoutTrailingSlash(path);
    try {
      await create(target, kind);
    } catch (cause) {
      notifyError(errorReason(cause, `Could not create ${target}`));
      throw cause;
    }
    if (kind === "directory") rememberFolder(target);
    refresh();
    if (kind === "file") openFile(target);
  };

  const withPendingFolders: FileActionsFunctions["withPendingFolders"] = (
    paths
  ) => {
    const empty = d.data.pendingFolders.filter(
      (folder) => !paths.some((path) => path.startsWith(`${folder}/`))
    );
    return empty.length === 0
      ? paths
      : [...paths, ...empty.map((folder) => `${folder}/`)];
  };

  return { create: createEntry, withPendingFolders };
}
