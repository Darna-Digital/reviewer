import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  importScanFile,
  importStateFile,
  MAX_OPENED,
  readOpened,
  readOpenWorkspace,
  readScan,
  recordOpened,
  writeOpenWorkspace,
  writeScan,
} from "./app-state.ts";
import { closeDatabase, openDatabase } from "./database.ts";

let dir: string;

beforeEach(() => {
  openDatabase(":memory:");
  dir = mkdtempSync(join(tmpdir(), "app-state-"));
});

afterEach(() => {
  closeDatabase();
  rmSync(dir, { recursive: true });
});

const file = (name: string, contents: unknown) => {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(contents));
  return path;
};

describe("what is open", () => {
  it("keeps the roots in order with the saved workspace they are", () => {
    writeOpenWorkspace({ roots: ["/b", "/a"], workspaceId: null });
    expect(readOpenWorkspace()).toEqual({
      roots: ["/b", "/a"],
      workspaceId: null,
    });
    writeOpenWorkspace({ roots: ["/c"], workspaceId: null });
    expect(readOpenWorkspace().roots).toEqual(["/c"]);
  });
});

describe("the repositories opened before", () => {
  it("keeps each at its latest open, newest first", () => {
    recordOpened([{ path: "/a", openedAt: "2026-01-02T00:00:00.000Z" }]);
    recordOpened([
      { path: "/a", openedAt: "2026-01-01T00:00:00.000Z" },
      { path: "/b", openedAt: "2026-01-03T00:00:00.000Z" },
    ]);
    expect(readOpened()).toEqual([
      { path: "/b", openedAt: "2026-01-03T00:00:00.000Z" },
      { path: "/a", openedAt: "2026-01-02T00:00:00.000Z" },
    ]);
  });

  it("lets the oldest go past the recents' length", () => {
    recordOpened(
      Array.from({ length: MAX_OPENED + 3 }, (_, index) => ({
        path: `/r${index}`,
        openedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      }))
    );
    const opened = readOpened();
    expect(opened).toHaveLength(MAX_OPENED);
    expect(opened.at(-1)?.path).toBe("/r3");
  });
});

describe("the files it replaces", () => {
  it("takes state.json across once — roots, else the one repository", () => {
    const path = file("state.json", {
      current: "/a",
      recents: ["/a", { path: "/b", openedAt: "2026-01-01T00:00:00.000Z" }],
    });
    importStateFile(path, new Date("2026-02-01T00:00:00.000Z"));
    expect(readOpenWorkspace().roots).toEqual(["/a"]);
    expect(readOpened().map((entry) => entry.path)).toEqual(["/a", "/b"]);

    writeOpenWorkspace({ roots: ["/c"], workspaceId: null });
    importStateFile(file("state.json", { roots: ["/x"] }));
    expect(readOpenWorkspace().roots).toEqual(["/c"]);
  });

  it("takes repos.json across once", () => {
    importScanFile(
      file("repos.json", {
        repos: [{ name: "web", path: "/w", branch: "main" }],
        scannedAt: "2026-01-01T00:00:00.000Z",
      })
    );
    expect(readScan()).toEqual({
      repos: [{ name: "web", path: "/w", branch: "main" }],
      scannedAt: "2026-01-01T00:00:00.000Z",
    });
    writeScan({ repos: [], scannedAt: "2026-02-01T00:00:00.000Z" });
    expect(readScan().repos).toEqual([]);
  });
});
