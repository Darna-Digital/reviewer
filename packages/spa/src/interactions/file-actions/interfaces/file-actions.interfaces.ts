/**
 * `file-actions` feature — creating files and folders from the file tree. The
 * logic worth testing is where a new entry lands, what it is called before the
 * user names it, and keeping a brand-new empty folder on screen (git lists
 * files, so it cannot see one). The API call, toast and refresh are injected.
 */
export type PathKind = "file" | "directory";

/** What the tree hands a context menu: a row's kind and its canonical path. */
export interface TreeItem {
  readonly kind: PathKind;
  readonly path: string;
}

export interface FileActionsDependencies {
  data: {
    /** Folders created this session that still hold nothing git can list. */
    readonly pendingFolders: ReadonlyArray<string>;
  };
  sideEffects: {
    readonly create: (path: string, kind: PathKind) => Promise<void>;
    readonly rememberFolder: (path: string) => void;
    readonly openFile: (path: string) => void;
    readonly notifyError: (text: string) => void;
    readonly refresh: () => void;
  };
}

export interface FileActionsFunctions {
  /**
   * Create the entry and reveal it. Rejects when the server refuses, so the
   * tree can drop the row it optimistically drew.
   */
  readonly create: (path: string, kind: PathKind) => Promise<void>;
  /** Tree paths, plus the created folders nothing has been put in yet. */
  readonly withPendingFolders: (
    paths: ReadonlyArray<string>
  ) => ReadonlyArray<string>;
}
