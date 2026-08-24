/**
 * `file-actions` feature — the file and folder operations the code tree offers
 * on the project's own files: creating, moving, duplicating, cut/copy/paste,
 * taking in files dropped from the desktop, deleting, and showing one in the
 * operating system's file manager.
 *
 * Every one of them is expressed as a list of `FileStep`s, and carrying steps
 * out hands back the steps that put them back — which is the whole of undo and
 * redo. Deleting moves a path into the project's trash rather than unlinking
 * it, so it has a way back like everything else. The API calls, toasts and
 * refresh are injected.
 */
export type PathKind = "file" | "directory";

/** What the tree hands a context menu: a row's kind and its canonical path. */
export interface TreeItem {
  readonly kind: PathKind;
  readonly path: string;
}

/** A move from one project path to another — a drag, a rename, a cut/paste. */
export interface PathMove {
  readonly from: string;
  readonly to: string;
}

/**
 * A typed entry in the tree's "New" menu — "TypeScript File", and the
 * extension it stamps on a name that doesn't spell its own.
 */
export interface NewFileTemplate {
  readonly label: string;
  readonly extension: `.${string}`;
}

/** Where the tree says a drag was let go — a folder row, or empty space. */
export interface DropTarget {
  readonly kind: "directory" | "root";
  readonly directoryPath: string | null;
}

/** Rows held by a cut or a copy until something is pasted. */
export interface Clipboard {
  readonly mode: "copy" | "cut";
  readonly paths: ReadonlyArray<string>;
}

/**
 * One file of a drop that came from outside the project. `relativePath` is the
 * path within the drop, so a dropped folder keeps its shape; the bytes are read
 * on demand, so a folder of a hundred files is not held in memory at once.
 */
export interface DroppedFile {
  readonly relativePath: string;
  readonly readBase64: () => Promise<string>;
}

/** One reversible thing done to the project's files. */
export type FileStep =
  | { readonly op: "create"; readonly path: string; readonly kind: PathKind }
  | { readonly op: "move"; readonly from: string; readonly to: string }
  | { readonly op: "copy"; readonly from: string; readonly to: string }
  | {
      readonly op: "upload";
      readonly path: string;
      readonly read: () => Promise<string>;
    }
  | { readonly op: "trash"; readonly path: string };

/** A change on the stack, holding the steps that take the project back. */
export interface FileChange {
  readonly label: string;
  readonly steps: ReadonlyArray<FileStep>;
}

export interface FileHistory {
  readonly changes: ReadonlyArray<FileChange>;
  /** How many changes are applied; undo steps down it, redo back up. */
  readonly applied: number;
}

/** Whether the tree already holds a path, as a file or as a folder. */
export type PathExists = (path: string) => boolean;

/** The writes a step list is carried out with. */
export interface FileStepEffects {
  readonly create: (path: string, kind: PathKind) => Promise<void>;
  readonly move: (from: string, to: string) => Promise<void>;
  readonly copy: (from: string, to: string) => Promise<void>;
  readonly upload: (path: string, base64: string) => Promise<void>;
  /** Move a path into the project's trash, answering where it went. */
  readonly trash: (path: string) => Promise<string>;
}

export interface FileActionsDependencies {
  data: {
    /** Folders created this session that still hold nothing git can list. */
    readonly pendingFolders: ReadonlyArray<string>;
    readonly history: FileHistory;
  };
  sideEffects: FileStepEffects & {
    readonly reveal: (path: string) => Promise<void>;
    readonly rememberFolder: (path: string) => void;
    readonly openFile: (path: string) => void;
    readonly record: (history: FileHistory) => void;
    readonly notify: (text: string) => void;
    readonly notifyError: (text: string) => void;
    /** Ask before replacing a file a drop would land on top of. */
    readonly confirm: (question: string) => boolean;
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
  /**
   * Move dropped rows into `directory` (the project root is `""`). Rejects when
   * any of them is refused, so the tree can put the rows back where they were.
   */
  readonly move: (
    paths: ReadonlyArray<string>,
    directory: string
  ) => Promise<void>;
  /** Copy a path beside itself, as `name copy`. */
  readonly duplicate: (path: string, exists: PathExists) => Promise<void>;
  /** Land a cut or a copy in `directory`, renaming around what is there. */
  readonly paste: (
    clipboard: Clipboard,
    directory: string,
    exists: PathExists
  ) => Promise<void>;
  /** Write files dropped from the desktop into `directory`. */
  readonly upload: (
    files: ReadonlyArray<DroppedFile>,
    directory: string,
    exists: PathExists
  ) => Promise<void>;
  /** Move rows into the project's trash, where undo can fetch them back. */
  readonly trash: (items: ReadonlyArray<TreeItem>) => Promise<void>;
  /** Show the path in Finder, Explorer, or whatever the desktop uses. */
  readonly reveal: (path: string) => Promise<void>;
  readonly undo: () => Promise<void>;
  readonly redo: () => Promise<void>;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}
