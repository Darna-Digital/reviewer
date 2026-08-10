import { describe, expect, it, vi } from "vitest";
import {
  createFileActionsFunctions,
  draftPath,
  parentDirectory,
  targetDirectory,
} from "./file-actions.functions";
import { createFileActionsDependenciesMock } from "./file-actions.functions.mock";

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
  const nothingExists = () => false;
  const taken =
    (...paths: ReadonlyArray<string>) =>
    (path: string) =>
      paths.includes(path);

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

describe("withPendingFolders", () => {
  it("keeps a created folder visible while it is still empty", () => {
    const fns = createFileActionsFunctions(
      createFileActionsDependenciesMock(undefined, ["src/new"])
    );
    expect(fns.withPendingFolders(["src/a.ts"])).toEqual([
      "src/a.ts",
      "src/new/",
    ]);
  });

  it("drops it once something in it is listed", () => {
    const fns = createFileActionsFunctions(
      createFileActionsDependenciesMock(undefined, ["src/new"])
    );
    expect(fns.withPendingFolders(["src/new/a.ts"])).toEqual(["src/new/a.ts"]);
  });
});
