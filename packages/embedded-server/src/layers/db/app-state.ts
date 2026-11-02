/**
 * The app's own state, beside every repository's — what is open, what was
 * opened before, and the last walk for repositories — in the database rather
 * than the `state.json` and `repos.json` it used to be kept in.
 *
 * Several servers share it, one per Reviewer window, and the TUI with them:
 * each write is a statement or a transaction, so two of them writing at once
 * is SQLite's to settle, where the files needed reading, merging and writing
 * back, and still lost the write that landed between the read and the write.
 *
 * Plain synchronous functions, like `scope.ts`: the workspace context reads
 * them while it boots, and `node:sqlite` answers synchronously anyway.
 *
 * The files themselves are taken across once each (`importStateFile`,
 * `importScanFile`), recorded in `legacy_import` the way a repository's old
 * `.reviewer/*.json` files are, and left on disk — an import is a far less
 * alarming thing to run when what it read is still there.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { allRows, execute, oneRow, transact } from "./database.ts";
import { imported, markImported } from "./legacy-import.ts";

/** A repository opened before, and when it last was. */
export interface OpenedRepo {
  readonly path: string;
  readonly openedAt: string;
}

/** What is open: the roots side by side, and the saved workspace they are. */
export interface OpenWorkspace {
  readonly roots: ReadonlyArray<string>;
  readonly workspaceId: string | null;
}

/** A repository the last walk found. */
export interface ScannedRepo {
  readonly path: string;
  readonly name: string;
  readonly branch: string | null;
}

export interface RepoScan {
  readonly repos: ReadonlyArray<ScannedRepo>;
  /** When the last complete walk finished, or null before the first has. */
  readonly scannedAt: string | null;
}

/** How many past opens the opener's Recents keeps. */
export const MAX_OPENED = 20;

// MARK: open

export const readOpenWorkspace = (): OpenWorkspace => ({
  roots: allRows<{ path: string }>(
    "SELECT path FROM open_root ORDER BY position"
  ).map((row) => row.path),
  workspaceId:
    oneRow<{ workspace_id: string | null }>(
      "SELECT workspace_id FROM open_workspace WHERE slot = 0"
    )?.workspace_id ?? null,
});

/** What is open, replaced as a whole, so a reader never sees half of it. */
export const writeOpenWorkspace = (open: OpenWorkspace): void =>
  transact(() => {
    execute("DELETE FROM open_root");
    open.roots.forEach((path, position) =>
      execute(
        "INSERT INTO open_root (path, position) VALUES (?, ?)",
        path,
        position
      )
    );
    execute(
      `INSERT INTO open_workspace (slot, workspace_id) VALUES (0, ?)
       ON CONFLICT (slot) DO UPDATE SET workspace_id = excluded.workspace_id`,
      open.workspaceId
    );
  });

// MARK: opened before

/** The repositories opened before, most recent first. */
export const readOpened = (): ReadonlyArray<OpenedRepo> =>
  allRows<{ path: string; opened_at: string }>(
    "SELECT path, opened_at FROM opened_repo ORDER BY opened_at DESC LIMIT ?",
    MAX_OPENED
  ).map((row) => ({ path: row.path, openedAt: row.opened_at }));

/**
 * Opens dated, each kept at its latest — another window's later open of the
 * same repository is not undone by this one's — and the oldest past the
 * recents' length let go.
 */
export const recordOpened = (opens: ReadonlyArray<OpenedRepo>): void =>
  transact(() => {
    for (const open of opens) {
      execute(
        `INSERT INTO opened_repo (path, opened_at) VALUES (?, ?)
         ON CONFLICT (path) DO UPDATE SET opened_at = max(opened_at, excluded.opened_at)`,
        open.path,
        open.openedAt
      );
    }
    execute(
      `DELETE FROM opened_repo WHERE path NOT IN (
         SELECT path FROM opened_repo ORDER BY opened_at DESC LIMIT ?
       )`,
      MAX_OPENED
    );
  });

// MARK: the walk for repositories

export const readScan = (): RepoScan => ({
  repos: allRows<{ path: string; name: string; branch: string | null }>(
    "SELECT path, name, branch FROM scanned_repo ORDER BY name, path"
  ),
  scannedAt:
    oneRow<{ scanned_at: string | null }>(
      "SELECT scanned_at FROM repo_scan WHERE slot = 0"
    )?.scanned_at ?? null,
});

/** A finished walk's listing, in place of the last one's. */
export const writeScan = (scan: RepoScan): void =>
  transact(() => {
    execute("DELETE FROM scanned_repo");
    for (const repo of scan.repos) {
      execute(
        `INSERT INTO scanned_repo (path, name, branch) VALUES (?, ?, ?)
         ON CONFLICT (path) DO NOTHING`,
        repo.path,
        repo.name,
        repo.branch
      );
    }
    execute(
      `INSERT INTO repo_scan (slot, scanned_at) VALUES (0, ?)
       ON CONFLICT (slot) DO UPDATE SET scanned_at = excluded.scanned_at`,
      scan.scannedAt
    );
  });

// MARK: the files it replaces

/** `legacy_import`'s scope for what was the app's own, not a repository's. */
const APP_SCOPE = "~";

const REVIEWER_DIR = `${homedir()}/.reviewer`;

const readJson = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const strings = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

/**
 * Take a file across once. A file missing or unreadable still counts as
 * done — there is nothing in it to wait for — but a failure to write what
 * was read is left unmarked, for the next boot to try again.
 */
const importOnce = (feature: string, take: () => void): void => {
  if (imported(APP_SCOPE, feature)) return;
  try {
    transact(() => {
      take();
      markImported(APP_SCOPE, feature);
    });
  } catch (error) {
    console.warn(
      `reviewer: could not import ~/.reviewer/${feature} —`,
      error instanceof Error ? error.message : error
    );
  }
};

/**
 * What was open and what was opened before, from `state.json`: its roots,
 * or the one repository a state written before workspaces kept, and its
 * recents — dated, or bare paths dated a second apart from when the file
 * was written, the order they were kept in.
 */
export const importStateFile = (
  path = `${REVIEWER_DIR}/state.json`,
  writtenAt: Date = new Date()
): void =>
  importOnce("state.json", () => {
    const state = readJson(path);
    if (!isRecord(state)) return;
    const roots = strings(state["roots"]);
    const current =
      typeof state["current"] === "string" ? state["current"] : null;
    if (readOpenWorkspace().roots.length === 0) {
      writeOpenWorkspace({
        roots: roots.length > 0 ? roots : current === null ? [] : [current],
        workspaceId: null,
      });
    }
    const recents = Array.isArray(state["recents"]) ? state["recents"] : [];
    recordOpened(
      recents.flatMap((entry, index): OpenedRepo[] => {
        if (typeof entry === "string") {
          const openedAt = new Date(writtenAt.getTime() - index * 1000);
          return [{ path: entry, openedAt: openedAt.toISOString() }];
        }
        if (
          isRecord(entry) &&
          typeof entry["path"] === "string" &&
          typeof entry["openedAt"] === "string"
        ) {
          return [{ path: entry["path"], openedAt: entry["openedAt"] }];
        }
        return [];
      })
    );
  });

/** The last walk's listing, from `repos.json`, so the opener has it at once. */
export const importScanFile = (path = `${REVIEWER_DIR}/repos.json`): void =>
  importOnce("repos.json", () => {
    const cache = readJson(path);
    if (!isRecord(cache) || readScan().scannedAt !== null) return;
    const repos = (Array.isArray(cache["repos"]) ? cache["repos"] : [])
      .filter(isRecord)
      .flatMap((repo): ScannedRepo[] =>
        typeof repo["path"] === "string" && typeof repo["name"] === "string"
          ? [
              {
                path: repo["path"],
                name: repo["name"],
                branch:
                  typeof repo["branch"] === "string" ? repo["branch"] : null,
              },
            ]
          : []
      );
    writeScan({
      repos,
      scannedAt:
        typeof cache["scannedAt"] === "string" ? cache["scannedAt"] : null,
    });
  });
