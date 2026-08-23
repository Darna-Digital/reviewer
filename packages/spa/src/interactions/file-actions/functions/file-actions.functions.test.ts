import { describe, expect, it, vi } from "vitest";
import {
  afterRedo,
  afterUndo,
  carryOut,
  createFileActionsFunctions,
  draftPath,
  dropDirectory,
  EMPTY_HISTORY,
  freeCopyPath,
  movesInto,
  parentDirectory,
  pastePlan,
  recorded,
  redoable,
  targetDirectory,
  undoable,
  withTemplateExtension,
} from "./file-actions.functions";
import {
  createFileActionsDependenciesMock,
  createFileActionsHistoryMock,
} from "./file-actions.functions.mock";
import type {
  DroppedFile,
  FileStep,
  FileStepEffects,
} from "../interfaces/file-actions.interfaces";

const nothingExists = () => false;
const taken =
  (...paths: ReadonlyArray<string>) =>
  (path: string) =>
    paths.includes(path);

describe("targetDirectory", () => {
  it("puts a new entry inside the folder that was clicked", () => {
    expect(targetDirectory({ kind: "directory", path: "src/lib/" })).toBe(
      "src/lib"
    );
  });

  it("puts a new entry beside the file that was clicked", () => {
    expect(targetDirectory({ kind: "file", path: "src/lib/a.ts" })).toBe(
      "src/lib"
    );
  });

  it("treats a file at the top level as living in the repository root", () => {
    expect(targetDirectory({ kind: "file", path: "README.md" })).toBe("");
    expect(parentDirectory("README.md")).toBe("");
  });
});

describe("draftPath", () => {
  it("marks a folder draft as a folder so the tree draws one", () => {
    expect(draftPath("src", "directory", nothingExists)).toBe("src/ /");
    expect(draftPath("src", "file", nothingExists)).toBe("src/ ");
  });

  it("drafts into the root when no folder was clicked", () => {
    expect(draftPath("", "file", nothingExists)).toBe(" ");
  });

  it("steps past names the tree already has a row for", () => {
    expect(draftPath("src", "file", taken("src/ ", "src/  "))).toBe("src/   ");
  });

  it("leaves the draft blank, so committing it unnamed drops the row", () => {
    expect(
      draftPath("src", "file", nothingExists).split("/").at(-1)?.trim()
    ).toBe("");
  });
});

describe("withTemplateExtension", () => {
  it("stamps the template's extension on a bare name", () => {
    expect(withTemplateExtension("src/util", ".ts")).toBe("src/util.ts");
  });

  it("takes a name that spells its own extension at its word", () => {
    expect(withTemplateExtension("src/util.js", ".ts")).toBe("src/util.js");
    expect(withTemplateExtension("src/util.ts", ".ts")).toBe("src/util.ts");
  });

  it("leaves a dotfile's name whole", () => {
    expect(withTemplateExtension("src/.env", ".ts")).toBe("src/.env");
  });

  it("only reads the basename for dots, not the folders above it", () => {
    expect(withTemplateExtension("src/v1.2/util", ".ts")).toBe(
      "src/v1.2/util.ts"
    );
  });

  it("leaves a plain file or folder draft alone", () => {
    expect(withTemplateExtension("src/util", null)).toBe("src/util");
  });
});

describe("movesInto", () => {
  it("moves each dragged row into the folder it was dropped on", () => {
    expect(movesInto(["src/a.ts", "docs/b.md"], "lib")).toEqual([
      { from: "src/a.ts", to: "lib/a.ts" },
      { from: "docs/b.md", to: "lib/b.md" },
    ]);
  });

  it("moves folders as folders, dropping the tree's trailing slash", () => {
    expect(movesInto(["src/lib/"], "vendor")).toEqual([
      { from: "src/lib", to: "vendor/lib" },
    ]);
  });

  it("moves to the repository root when the drop missed every row", () => {
    expect(movesInto(["src/a.ts"], "")).toEqual([
      { from: "src/a.ts", to: "a.ts" },
    ]);
  });

  it("is not a move when the row is already in that folder", () => {
    expect(movesInto(["src/a.ts"], "src")).toEqual([]);
    expect(movesInto(["a.ts"], "")).toEqual([]);
  });

  it("refuses to put a folder inside itself or anything under it", () => {
    expect(movesInto(["src/"], "src/lib")).toEqual([]);
    expect(movesInto(["src/"], "src")).toEqual([]);
  });
});

describe("dropDirectory", () => {
  it("reads the folder row a drag was let go over", () => {
    expect(
      dropDirectory({ kind: "directory", directoryPath: "src/lib/" })
    ).toBe("src/lib");
  });

  it("reads empty space as the repository root", () => {
    expect(dropDirectory({ kind: "root", directoryPath: null })).toBe("");
    expect(dropDirectory({ kind: "directory", directoryPath: null })).toBe("");
  });
});

describe("freeCopyPath", () => {
  it("names the first copy after the file, keeping its extension", () => {
    expect(freeCopyPath("src/a.ts", nothingExists)).toBe("src/a copy.ts");
  });

  it("counts the ones after it", () => {
    expect(freeCopyPath("src/a.ts", taken("src/a copy.ts"))).toBe(
      "src/a copy 2.ts"
    );
  });

  it("leaves a dotfile's name whole", () => {
    expect(freeCopyPath(".env", nothingExists)).toBe(".env copy");
  });

  it("copies a folder without inventing an extension", () => {
    expect(freeCopyPath("src/lib", nothingExists)).toBe("src/lib copy");
  });
});

describe("pastePlan", () => {
  const cut = (...paths: ReadonlyArray<string>) =>
    ({ mode: "cut", paths }) as const;
  const copied = (...paths: ReadonlyArray<string>) =>
    ({ mode: "copy", paths }) as const;

  it("moves what was cut", () => {
    expect(pastePlan(cut("src/a.ts"), "lib", nothingExists)).toEqual({
      moves: [{ from: "src/a.ts", to: "lib/a.ts" }],
      copies: [],
    });
  });

  it("will not let a cut overwrite what is already named that", () => {
    expect(pastePlan(cut("src/a.ts"), "lib", taken("lib/a.ts")).moves).toEqual(
      []
    );
  });

  it("copies under the same name when the folder is free", () => {
    expect(pastePlan(copied("src/a.ts"), "lib", nothingExists).copies).toEqual([
      { from: "src/a.ts", to: "lib/a.ts" },
    ]);
  });

  it("renames a copy around what is there, so pasting in place duplicates", () => {
    expect(
      pastePlan(copied("src/a.ts"), "src", taken("src/a.ts")).copies
    ).toEqual([{ from: "src/a.ts", to: "src/a copy.ts" }]);
  });

  it("does not name two copies of the same paste the same thing", () => {
    expect(
      pastePlan(copied("one/a.ts", "two/a.ts"), "lib", nothingExists).copies
    ).toEqual([
      { from: "one/a.ts", to: "lib/a.ts" },
      { from: "two/a.ts", to: "lib/a copy.ts" },
    ]);
  });
});

describe("create", () => {
  it("creates a file, refreshes and opens it", async () => {
    const deps = createFileActionsDependenciesMock();
    await createFileActionsFunctions(deps).create("src/a.ts", "file");
    expect(deps.sideEffects.create).toHaveBeenCalledWith("src/a.ts", "file");
    expect(deps.sideEffects.refresh).toHaveBeenCalled();
    expect(deps.sideEffects.openFile).toHaveBeenCalledWith("src/a.ts");
    expect(deps.sideEffects.rememberFolder).not.toHaveBeenCalled();
  });

  it("creates a folder without a trailing slash, and remembers it", async () => {
    const deps = createFileActionsDependenciesMock();
    await createFileActionsFunctions(deps).create("src/new/", "directory");
    expect(deps.sideEffects.create).toHaveBeenCalledWith(
      "src/new",
      "directory"
    );
    expect(deps.sideEffects.rememberFolder).toHaveBeenCalledWith("src/new");
    expect(deps.sideEffects.openFile).not.toHaveBeenCalled();
  });

  it("reports the server's reason and rejects when creation fails", async () => {
    const deps = createFileActionsDependenciesMock({
      create: vi.fn(async () => {
        throw new Error("src/a.ts already exists");
      }),
    });
    await expect(
      createFileActionsFunctions(deps).create("src/a.ts", "file")
    ).rejects.toThrow("src/a.ts already exists");
    expect(deps.sideEffects.notifyError).toHaveBeenCalledWith(
      "src/a.ts already exists"
    );
    expect(deps.sideEffects.refresh).not.toHaveBeenCalled();
  });
});

describe("move", () => {
  it("renames every dropped row into the folder it landed on", async () => {
    const deps = createFileActionsDependenciesMock();
    await createFileActionsFunctions(deps).move(
      ["src/a.ts", "src/lib/"],
      "out"
    );
    expect(deps.sideEffects.move).toHaveBeenNthCalledWith(
      1,
      "src/a.ts",
      "out/a.ts"
    );
    expect(deps.sideEffects.move).toHaveBeenNthCalledWith(
      2,
      "src/lib",
      "out/lib"
    );
    expect(deps.sideEffects.refresh).toHaveBeenCalled();
  });

  it("asks for nothing when the drop changes nothing", async () => {
    const deps = createFileActionsDependenciesMock();
    await createFileActionsFunctions(deps).move(["src/a.ts"], "src");
    expect(deps.sideEffects.move).not.toHaveBeenCalled();
    expect(deps.sideEffects.refresh).not.toHaveBeenCalled();
  });

  it("rejects when the server refuses, so the tree can put the row back", async () => {
    const deps = createFileActionsDependenciesMock({
      move: vi.fn(async () => {
        throw new Error("out/a.ts already exists");
      }),
    });
    await expect(
      createFileActionsFunctions(deps).move(["src/a.ts"], "out")
    ).rejects.toThrow("out/a.ts already exists");
    expect(deps.sideEffects.notifyError).toHaveBeenCalledWith(
      "out/a.ts already exists"
    );
    expect(deps.sideEffects.record).not.toHaveBeenCalled();
    expect(deps.sideEffects.refresh).not.toHaveBeenCalled();
  });

  it("keeps the part that went through, so it can still be undone", async () => {
    const deps = createFileActionsDependenciesMock({
      move: vi.fn(async (from: string) => {
        if (from === "src/b.ts") throw new Error("out/b.ts already exists");
      }),
    });
    await expect(
      createFileActionsFunctions(deps).move(["src/a.ts", "src/b.ts"], "out")
    ).rejects.toThrow();
    expect(deps.sideEffects.record).toHaveBeenCalledWith({
      applied: 1,
      changes: [
        {
          label: "Move 2 items",
          steps: [{ op: "move", from: "out/a.ts", to: "src/a.ts" }],
        },
      ],
    });
  });
});

describe("duplicate", () => {
  it("copies the path to the first free copy of its name", async () => {
    const deps = createFileActionsDependenciesMock();
    await createFileActionsFunctions(deps).duplicate(
      "src/a.ts",
      taken("src/a copy.ts")
    );
    expect(deps.sideEffects.copy).toHaveBeenCalledWith(
      "src/a.ts",
      "src/a copy 2.ts"
    );
    expect(deps.sideEffects.refresh).toHaveBeenCalled();
  });

  it("reports a refusal without leaving the tree to guess", async () => {
    const deps = createFileActionsDependenciesMock({
      copy: vi.fn(async () => {
        throw new Error("permission denied");
      }),
    });
    await createFileActionsFunctions(deps).duplicate("src/a.ts", nothingExists);
    expect(deps.sideEffects.notifyError).toHaveBeenCalledWith(
      "permission denied"
    );
    expect(deps.sideEffects.refresh).not.toHaveBeenCalled();
  });
});

describe("paste", () => {
  it("moves a cut and copies a copy", async () => {
    const deps = createFileActionsDependenciesMock();
    const fns = createFileActionsFunctions(deps);
    await fns.paste({ mode: "cut", paths: ["src/a.ts"] }, "lib", nothingExists);
    expect(deps.sideEffects.move).toHaveBeenCalledWith("src/a.ts", "lib/a.ts");
    await fns.paste(
      { mode: "copy", paths: ["src/a.ts"] },
      "lib",
      nothingExists
    );
    expect(deps.sideEffects.copy).toHaveBeenCalledWith("src/a.ts", "lib/a.ts");
  });

  it("does nothing when a cut would land on top of itself", async () => {
    const deps = createFileActionsDependenciesMock();
    await createFileActionsFunctions(deps).paste(
      { mode: "cut", paths: ["src/a.ts"] },
      "src",
      taken("src/a.ts")
    );
    expect(deps.sideEffects.move).not.toHaveBeenCalled();
    expect(deps.sideEffects.refresh).not.toHaveBeenCalled();
  });
});

describe("upload", () => {
  const dropped = (relativePath: string, contents = "aGk="): DroppedFile => ({
    relativePath,
    readBase64: vi.fn(async () => contents),
  });

  it("writes each dropped file under the folder it was dropped on", async () => {
    const deps = createFileActionsDependenciesMock();
    await createFileActionsFunctions(deps).upload(
      [dropped("logo.png"), dropped("icons/a.svg")],
      "assets",
      nothingExists
    );
    expect(deps.sideEffects.upload).toHaveBeenNthCalledWith(
      1,
      "assets/logo.png",
      "aGk="
    );
    expect(deps.sideEffects.upload).toHaveBeenNthCalledWith(
      2,
      "assets/icons/a.svg",
      "aGk="
    );
    expect(deps.sideEffects.refresh).toHaveBeenCalled();
  });

  it("trashes the file it replaces first, so undo has it back", async () => {
    const deps = createFileActionsDependenciesMock();
    await createFileActionsFunctions(deps).upload(
      [dropped("logo.png")],
      "assets",
      taken("assets/logo.png")
    );
    expect(deps.sideEffects.confirm).toHaveBeenCalledWith(
      "Replace assets/logo.png?"
    );
    expect(deps.sideEffects.trash).toHaveBeenCalledWith("assets/logo.png");
    expect(deps.sideEffects.upload).toHaveBeenCalledWith(
      "assets/logo.png",
      "aGk="
    );
  });

  it("skips the file, and only that file, when the answer is no", async () => {
    const deps = createFileActionsDependenciesMock({
      confirm: vi.fn((question) => !question.includes("logo.png")),
    });
    const files = [dropped("logo.png"), dropped("b.png")];
    await createFileActionsFunctions(deps).upload(
      files,
      "assets",
      taken("assets/logo.png", "assets/b.png")
    );
    expect(files[0].readBase64).not.toHaveBeenCalled();
    expect(deps.sideEffects.upload).toHaveBeenCalledTimes(1);
    expect(deps.sideEffects.upload).toHaveBeenCalledWith(
      "assets/b.png",
      "aGk="
    );
  });

  it("leaves the tree alone when every file was declined", async () => {
    const deps = createFileActionsDependenciesMock({
      confirm: vi.fn(() => false),
    });
    await createFileActionsFunctions(deps).upload(
      [dropped("logo.png")],
      "assets",
      taken("assets/logo.png")
    );
    expect(deps.sideEffects.refresh).not.toHaveBeenCalled();
  });
});

describe("trash", () => {
  it("moves each row into the trash rather than unlinking it", async () => {
    const deps = createFileActionsDependenciesMock();
    await createFileActionsFunctions(deps).trash([
      { kind: "file", path: "src/a.ts" },
      { kind: "directory", path: "src/lib/" },
    ]);
    expect(deps.sideEffects.trash).toHaveBeenNthCalledWith(1, "src/a.ts");
    expect(deps.sideEffects.trash).toHaveBeenNthCalledWith(2, "src/lib");
  });
});

describe("carryOut", () => {
  const effects = (overrides?: Partial<FileStepEffects>): FileStepEffects => ({
    create: vi.fn(async () => undefined),
    move: vi.fn(async () => undefined),
    copy: vi.fn(async () => undefined),
    upload: vi.fn(async () => undefined),
    trash: vi.fn(async (path: string) => `.byconvo/trash/1/${path}`),
    ...overrides,
  });

  it("hands back the steps that put each one back, innermost first", async () => {
    const { back } = await carryOut(
      [
        { op: "create", path: "src/a.ts", kind: "file" },
        { op: "move", from: "src/b.ts", to: "lib/b.ts" },
      ],
      effects()
    );
    expect(back).toEqual([
      { op: "move", from: "lib/b.ts", to: "src/b.ts" },
      { op: "trash", path: "src/a.ts" },
    ]);
  });

  it("undoes a delete by naming where the trash put it", async () => {
    const { back } = await carryOut(
      [{ op: "trash", path: "src/a.ts" }],
      effects()
    );
    expect(back).toEqual([
      { op: "move", from: ".byconvo/trash/1/src/a.ts", to: "src/a.ts" },
    ]);
  });

  it("running the reverse hands back the original, which is redo", async () => {
    const deps = effects();
    const forward: ReadonlyArray<FileStep> = [
      { op: "move", from: "src/a.ts", to: "lib/a.ts" },
    ];
    const { back } = await carryOut(forward, deps);
    expect((await carryOut(back, deps)).back).toEqual(forward);
  });

  it("stops at the step that threw, and keeps what already ran", async () => {
    const deps = effects({
      move: async (from) => {
        if (from === "src/b.ts") throw new Error("nope");
      },
    });
    const { back, failure } = await carryOut(
      [
        { op: "move", from: "src/a.ts", to: "lib/a.ts" },
        { op: "move", from: "src/b.ts", to: "lib/b.ts" },
        { op: "move", from: "src/c.ts", to: "lib/c.ts" },
      ],
      deps
    );
    expect(failure).toBeInstanceOf(Error);
    expect(back).toEqual([{ op: "move", from: "lib/a.ts", to: "src/a.ts" }]);
  });
});

describe("history", () => {
  const change = (label: string) => ({ label, steps: [] });

  it("records onto the end, and knows what can be undone", () => {
    const one = recorded(EMPTY_HISTORY, "Create a", []);
    expect(undoable(one)?.label).toBe("Create a");
    expect(redoable(one)).toBeUndefined();
  });

  it("steps back and forward over the same change", () => {
    const one = recorded(EMPTY_HISTORY, "Create a", []);
    const undone = afterUndo(one, []);
    expect(undoable(undone)).toBeUndefined();
    expect(redoable(undone)?.label).toBe("Create a");
    expect(undoable(afterRedo(undone, []))?.label).toBe("Create a");
  });

  it("holds the steps that reverse the change, flipping on each pass", () => {
    const forward: ReadonlyArray<FileStep> = [
      { op: "move", from: "a", to: "b" },
    ];
    const backward: ReadonlyArray<FileStep> = [
      { op: "move", from: "b", to: "a" },
    ];
    const one = recorded(EMPTY_HISTORY, "Move a", backward);
    expect(undoable(one)?.steps).toEqual(backward);
    expect(redoable(afterUndo(one, forward))?.steps).toEqual(forward);
  });

  it("forgets what was undone once something else is done instead", () => {
    const two = recorded(recorded(EMPTY_HISTORY, "one", []), "two", []);
    const back = afterUndo(two, []);
    const instead = recorded(back, "three", []);
    expect(instead.changes.map((c) => c.label)).toEqual(["one", "three"]);
    expect(redoable(instead)).toBeUndefined();
  });

  it("keeps the stack from growing without end", () => {
    let history = EMPTY_HISTORY;
    for (let at = 0; at < 60; at += 1) {
      history = recorded(history, `change ${at}`, []);
    }
    expect(history.changes).toHaveLength(50);
    expect(history.changes[0]).toEqual(change("change 10"));
  });
});

describe("undo and redo", () => {
  it("puts a deleted path back where it came from", async () => {
    const mock = createFileActionsHistoryMock();
    await createFileActionsFunctions(mock.deps()).trash([
      { kind: "file", path: "src/a.ts" },
    ]);
    await createFileActionsFunctions(mock.deps()).undo();
    expect(mock.sideEffects.move).toHaveBeenCalledWith(
      ".byconvo/trash/1/src/a.ts",
      "src/a.ts"
    );
    expect(mock.sideEffects.notify).toHaveBeenCalledWith(
      "Undid: Delete src/a.ts"
    );
  });

  it("takes a created file away again, and brings it back on redo", async () => {
    const mock = createFileActionsHistoryMock();
    await createFileActionsFunctions(mock.deps()).create("src/a.ts", "file");
    await createFileActionsFunctions(mock.deps()).undo();
    expect(mock.sideEffects.trash).toHaveBeenCalledWith("src/a.ts");
    await createFileActionsFunctions(mock.deps()).redo();
    // Moved back out of the trash rather than created empty, so whatever was
    // typed into it between the create and the undo survives.
    expect(mock.sideEffects.move).toHaveBeenCalledWith(
      ".byconvo/trash/1/src/a.ts",
      "src/a.ts"
    );
    expect(mock.sideEffects.create).toHaveBeenCalledTimes(1);
  });

  it("walks a drag of several rows back in one go", async () => {
    const mock = createFileActionsHistoryMock();
    await createFileActionsFunctions(mock.deps()).move(
      ["src/a.ts", "src/b.ts"],
      "lib"
    );
    await createFileActionsFunctions(mock.deps()).undo();
    expect(mock.sideEffects.move).toHaveBeenNthCalledWith(
      3,
      "lib/b.ts",
      "src/b.ts"
    );
    expect(mock.sideEffects.move).toHaveBeenNthCalledWith(
      4,
      "lib/a.ts",
      "src/a.ts"
    );
  });

  it("does nothing, quietly, when there is nothing to undo", async () => {
    const mock = createFileActionsHistoryMock();
    const fns = createFileActionsFunctions(mock.deps());
    expect(fns.canUndo).toBe(false);
    expect(fns.canRedo).toBe(false);
    await fns.undo();
    expect(mock.sideEffects.move).not.toHaveBeenCalled();
    expect(mock.sideEffects.notify).not.toHaveBeenCalled();
  });
});

describe("withPendingFolders", () => {
  it("keeps a created folder visible while it is still empty", () => {
    const fns = createFileActionsFunctions(
      createFileActionsDependenciesMock(undefined, {
        pendingFolders: ["src/new"],
      })
    );
    expect(fns.withPendingFolders(["src/a.ts"])).toEqual([
      "src/a.ts",
      "src/new/",
    ]);
  });

  it("drops it once something in it is listed", () => {
    const fns = createFileActionsFunctions(
      createFileActionsDependenciesMock(undefined, {
        pendingFolders: ["src/new"],
      })
    );
    expect(fns.withPendingFolders(["src/new/a.ts"])).toEqual(["src/new/a.ts"]);
  });
});
