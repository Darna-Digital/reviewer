import { errorReason } from "@/lib/errors";
import type {
  Clipboard,
  DropTarget,
  FileActionsDependencies,
  FileActionsFunctions,
  FileChange,
  FileHistory,
  FileStep,
  FileStepEffects,
  NewFileTemplate,
  PathExists,
  PathKind,
  PathMove,
  TreeItem,
} from "../interfaces/file-actions.interfaces";

/** The tree writes directories as `src/`; the API takes plain repo paths. */
export const withoutTrailingSlash = (path: string): string =>
  path.endsWith("/") ? path.slice(0, -1) : path;

export const parentDirectory = (path: string): string => {
  const separator = withoutTrailingSlash(path).lastIndexOf("/");
  return separator < 0 ? "" : path.slice(0, separator);
};

export const basename = (path: string): string =>
  withoutTrailingSlash(path).split("/").at(-1) ?? "";

/** A path inside `directory`, where the project root is spelled `""`. */
export const joinPath = (directory: string, name: string): string =>
  directory === "" ? name : `${directory}/${name}`;

/** Where a new entry goes when the menu was opened on `item`. */
export const targetDirectory = (item: TreeItem): string =>
  item.kind === "directory"
    ? withoutTrailingSlash(item.path)
    : parentDirectory(item.path);

/** The folder a drop landed in — the project root when it missed every row. */
export const dropDirectory = (target: DropTarget): string =>
  target.kind === "root" || target.directoryPath === null
    ? ""
    : withoutTrailingSlash(target.directoryPath);

const isWithin = (path: string, directory: string): boolean =>
  path === directory || path.startsWith(`${directory}/`);

/**
 * The moves a drop onto `directory` asks for. A row already sitting there is
 * not a move, and a folder cannot be dropped into itself or anything under it —
 * the tree guards its own drags, but a paste arrives here without that.
 */
export const movesInto = (
  paths: ReadonlyArray<string>,
  directory: string
): ReadonlyArray<PathMove> =>
  paths
    .map(withoutTrailingSlash)
    .filter(
      (path) =>
        parentDirectory(path) !== directory && !isWithin(directory, path)
    )
    .map((from) => ({ from, to: joinPath(directory, basename(from)) }));

// Finder's numbering, and the one the shell uses for a second copy: the first
// is plain "copy", and only the ones after it are counted.
const copyName = (path: string, ordinal: number): string => {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  const suffix = ordinal === 1 ? "copy" : `copy ${ordinal}`;
  return joinPath(parentDirectory(path), `${stem} ${suffix}${extension}`);
};

/** The first `name copy`, `name copy 2`, … beside `path` that is free. */
export const freeCopyPath = (path: string, exists: PathExists): string => {
  for (let ordinal = 1; ; ordinal += 1) {
    const candidate = copyName(path, ordinal);
    if (!exists(candidate)) return candidate;
  }
};

/**
 * Where a cut or a copy lands in `directory`. A cut keeps its names and refuses
 * to overwrite; a copy renames around whatever is already there, which is what
 * makes copy-and-paste-in-place a duplicate.
 */
export const pastePlan = (
  clipboard: Clipboard,
  directory: string,
  exists: PathExists
): { moves: ReadonlyArray<PathMove>; copies: ReadonlyArray<PathMove> } => {
  if (clipboard.mode === "cut") {
    return {
      moves: movesInto(clipboard.paths, directory).filter(
        (move) => !exists(move.to)
      ),
      copies: [],
    };
  }
  const copies: Array<PathMove> = [];
  const taken = new Set<string>();
  const isTaken = (path: string) => taken.has(path) || exists(path);
  for (const source of clipboard.paths.map(withoutTrailingSlash)) {
    const plain = joinPath(directory, basename(source));
    const to = isTaken(plain) ? freeCopyPath(plain, isTaken) : plain;
    taken.add(to);
    copies.push({ from: source, to });
  }
  return { moves: [], copies };
};

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
  exists: PathExists
): string => {
  const prefix = directory === "" ? "" : `${directory}/`;
  let name = DRAFT_BASENAME;
  while (exists(`${prefix}${name}`)) name += DRAFT_BASENAME;
  return `${prefix}${name}${kind === "directory" ? "/" : ""}`;
};

/** The typed entries the tree's "New" menu offers beside plain files. */
export const NEW_FILE_TEMPLATES: ReadonlyArray<NewFileTemplate> = [
  { label: "TypeScript File", extension: ".ts" },
  { label: "TSX File", extension: ".tsx" },
  { label: "JavaScript File", extension: ".js" },
  { label: "HTML File", extension: ".html" },
  { label: "JSON File", extension: ".json" },
  { label: "Markdown File", extension: ".md" },
];

/**
 * The path a typed template's draft commits to. A name that spells any
 * extension — or is a dotfile — is taken at its word, so "util.js" under the
 * TypeScript entry stays "util.js" rather than becoming "util.js.ts".
 */
export const withTemplateExtension = (
  path: string,
  extension: string | null
): string =>
  extension === null || basename(path).includes(".")
    ? path
    : `${path}${extension}`;

/**
 * Carry out each step in turn, and hand back the steps that put them back.
 *
 * Running those in turn hands back the original steps again, which is the whole
 * of undo and redo: a change on the stack is a step list that flips every time
 * it runs. `failure` is whatever stopped it — the steps that did run are still
 * returned, so a half-finished change can still be taken back.
 */
export const carryOut = async (
  steps: ReadonlyArray<FileStep>,
  effects: FileStepEffects
): Promise<{ back: ReadonlyArray<FileStep>; failure: unknown }> => {
  const back: Array<FileStep> = [];
  try {
    for (const step of steps) {
      switch (step.op) {
        case "create":
          await effects.create(step.path, step.kind);
          back.unshift({ op: "trash", path: step.path });
          break;
        case "move":
          await effects.move(step.from, step.to);
          back.unshift({ op: "move", from: step.to, to: step.from });
          break;
        case "copy":
          await effects.copy(step.from, step.to);
          back.unshift({ op: "trash", path: step.to });
          break;
        case "upload":
          await effects.upload(step.path, await step.read());
          back.unshift({ op: "trash", path: step.path });
          break;
        case "trash":
          back.unshift({
            op: "move",
            from: await effects.trash(step.path),
            to: step.path,
          });
          break;
      }
    }
  } catch (failure) {
    return { back, failure };
  }
  return { back, failure: null };
};

export const EMPTY_HISTORY: FileHistory = { changes: [], applied: 0 };

// Deep enough for a session's worth of tree edits; what falls off the end is
// only forgotten, never lost — a deleted path stays in the trash folder.
const HISTORY_DEPTH = 50;

/** Record a change, forgetting whatever had been undone past this point. */
export const recorded = (
  history: FileHistory,
  label: string,
  steps: ReadonlyArray<FileStep>
): FileHistory => {
  const changes = [
    ...history.changes.slice(0, history.applied),
    { label, steps },
  ].slice(-HISTORY_DEPTH);
  return { changes, applied: changes.length };
};

export const undoable = (history: FileHistory): FileChange | undefined =>
  history.applied > 0 ? history.changes[history.applied - 1] : undefined;

export const redoable = (history: FileHistory): FileChange | undefined =>
  history.applied < history.changes.length
    ? history.changes[history.applied]
    : undefined;

const flipped = (
  history: FileHistory,
  at: number,
  steps: ReadonlyArray<FileStep>,
  applied: number
): FileHistory => ({
  changes: history.changes.map((change, index) =>
    index === at ? { ...change, steps } : change
  ),
  applied,
});

/** Undone, that change now holds the steps that put it back on. */
export const afterUndo = (
  history: FileHistory,
  steps: ReadonlyArray<FileStep>
): FileHistory =>
  flipped(history, history.applied - 1, steps, history.applied - 1);

export const afterRedo = (
  history: FileHistory,
  steps: ReadonlyArray<FileStep>
): FileHistory => flipped(history, history.applied, steps, history.applied + 1);

export function createFileActionsFunctions(
  d: FileActionsDependencies
): FileActionsFunctions {
  const {
    confirm,
    notify,
    notifyError,
    openFile,
    record,
    refresh,
    rememberFolder,
    reveal,
  } = d.sideEffects;
  const { history } = d.data;

  /**
   * Run a change and put it on the undo stack. Answers what went wrong, so a
   * caller that drew the change optimistically can take it back off screen.
   */
  const perform = async (
    steps: ReadonlyArray<FileStep>,
    label: string,
    refused: string
  ): Promise<unknown> => {
    if (steps.length === 0) return null;
    const { back, failure } = await carryOut(steps, d.sideEffects);
    if (back.length > 0) {
      record(recorded(history, label, back));
      refresh();
    }
    if (failure !== null) notifyError(errorReason(failure, refused));
    return failure;
  };

  const createEntry: FileActionsFunctions["create"] = async (path, kind) => {
    const target = withoutTrailingSlash(path);
    const failure = await perform(
      [{ op: "create", path: target, kind }],
      `Create ${target}`,
      `Could not create ${target}`
    );
    if (failure !== null) throw failure;
    if (kind === "directory") rememberFolder(target);
    else openFile(target);
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

  const movePaths: FileActionsFunctions["move"] = async (paths, directory) => {
    const moves = movesInto(paths, directory);
    const first = moves.at(0);
    if (first === undefined) return;
    const where = directory === "" ? "the project root" : directory;
    const failure = await perform(
      moves.map(({ from, to }) => ({ op: "move" as const, from, to })),
      moves.length === 1 ? `Move ${first.from}` : `Move ${moves.length} items`,
      `Could not move into ${where}`
    );
    if (failure !== null) throw failure;
  };

  const duplicate: FileActionsFunctions["duplicate"] = async (path, exists) => {
    const from = withoutTrailingSlash(path);
    const to = freeCopyPath(from, exists);
    await perform(
      [{ op: "copy", from, to }],
      `Duplicate ${from}`,
      `Could not duplicate ${from}`
    );
  };

  const paste: FileActionsFunctions["paste"] = async (
    clipboard,
    directory,
    exists
  ) => {
    const { copies, moves } = pastePlan(clipboard, directory, exists);
    const steps: ReadonlyArray<FileStep> = [
      ...moves.map(({ from, to }) => ({ op: "move" as const, from, to })),
      ...copies.map(({ from, to }) => ({ op: "copy" as const, from, to })),
    ];
    const where = directory === "" ? "the project root" : directory;
    await perform(
      steps,
      `Paste into ${where}`,
      `Could not paste into ${where}`
    );
  };

  const upload: FileActionsFunctions["upload"] = async (
    files,
    directory,
    exists
  ) => {
    const steps: Array<FileStep> = [];
    for (const file of files) {
      const path = joinPath(directory, file.relativePath);
      // Replacing is a trash-then-write, so undo puts the old file back.
      if (exists(path)) {
        if (!confirm(`Replace ${path}?`)) continue;
        steps.push({ op: "trash", path });
      }
      steps.push({ op: "upload", path, read: file.readBase64 });
    }
    const written = steps.filter((step) => step.op === "upload");
    const only = written.length === 1 ? written[0].path : null;
    await perform(
      steps,
      only === null ? `Add ${written.length} files` : `Add ${only}`,
      "Could not add the dropped files"
    );
  };

  const trash: FileActionsFunctions["trash"] = async (items) => {
    const paths = items.map((item) => withoutTrailingSlash(item.path));
    const only = paths.length === 1 ? paths[0] : null;
    await perform(
      paths.map((path) => ({ op: "trash" as const, path })),
      only === null ? `Delete ${paths.length} items` : `Delete ${only}`,
      "Could not delete"
    );
  };

  const revealPath: FileActionsFunctions["reveal"] = async (path) => {
    try {
      await reveal(withoutTrailingSlash(path));
    } catch (cause) {
      notifyError(errorReason(cause, `Could not reveal ${path}`));
    }
  };

  const walk = async (
    change: FileChange | undefined,
    onward: (steps: ReadonlyArray<FileStep>) => FileHistory,
    said: "Undo" | "Redo"
  ) => {
    if (change === undefined) return;
    const { back, failure } = await carryOut(change.steps, d.sideEffects);
    record(onward(back));
    refresh();
    if (failure !== null) {
      notifyError(
        errorReason(failure, `Could not ${said.toLowerCase()} ${change.label}`)
      );
      return;
    }
    notify(`${said === "Undo" ? "Undid" : "Redid"}: ${change.label}`);
  };

  return {
    create: createEntry,
    withPendingFolders,
    move: movePaths,
    duplicate,
    paste,
    upload,
    trash,
    reveal: revealPath,
    undo: () =>
      walk(undoable(history), (back) => afterUndo(history, back), "Undo"),
    redo: () =>
      walk(redoable(history), (back) => afterRedo(history, back), "Redo"),
    canUndo: undoable(history) !== undefined,
    canRedo: redoable(history) !== undefined,
  };
}
