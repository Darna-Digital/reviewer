import { Database } from 'bun:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { ReviewComment } from '@reviewer/core/comments';
import type { CommentSide } from '@reviewer/core/comments';
import {
  decodeStoredDevCommand,
  normalizeDevCwd,
} from '@reviewer/core/local-dev';
import type { DevCommand } from '@reviewer/core/local-dev';
import { MIGRATIONS } from '@reviewer/embedded-server/migrations';
import * as Schema from 'effect/Schema';

export interface NewComment {
  filePath: string;
  side: CommentSide;
  lineNumber: number;
  body: string;
  author: string;
  target: string;
}

export type Store = ReturnType<typeof createStore>;

/** `REVIEWER_DB`, else the app's own `~/.reviewer/reviewer.db`. */
export function databasePath(): string {
  return process.env['REVIEWER_DB'] || `${homedir()}/.reviewer/reviewer.db`;
}

/**
 * Opens the database the embedded server keeps, applying the server's own
 * migrations, so comments and branch targets are shared with the Mac app.
 */
export function openStore(path = databasePath()): Store {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  migrate(db);
  if (path !== ':memory:') importLegacyFiles(db);
  return createStore(db);
}

/** `legacy_import`'s scope for what was the app's own, not a repository's. */
const APP_SCOPE = '~';

/** Where the TUI kept its preferences and layouts before the database. */
export const LEGACY_FILES = {
  settings: () =>
    process.env['REVIEWER_TUI_SETTINGS'] ||
    `${homedir()}/.reviewer/tui-settings.json`,
  uiState: () =>
    process.env['REVIEWER_TUI_STATE'] || `${homedir()}/.reviewer/tui.json`,
};

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Takes `tui-settings.json` and `tui.json` across once each, marked in
 * `legacy_import` as the server marks its own; the files stay on disk.
 */
export function importLegacyFiles(db: Database) {
  const once = (feature: string, take: () => void) => {
    const done = db
      .query<{ one: number }, [string, string]>(
        'SELECT 1 AS one FROM legacy_import WHERE repo_path = ? AND feature = ?',
      )
      .get(APP_SCOPE, feature);
    if (done) return;
    db.transaction(() => {
      take();
      db.prepare(
        `INSERT INTO legacy_import (repo_path, feature, imported_at) VALUES (?, ?, ?)
         ON CONFLICT (repo_path, feature) DO NOTHING`,
      ).run(APP_SCOPE, feature, new Date().toISOString());
    })();
  };
  once('tui-settings.json', () => {
    const saved = readJson(LEGACY_FILES.settings());
    if (!isRecord(saved)) return;
    db.prepare(
      `INSERT INTO tui_settings (slot, data) VALUES (0, ?)
       ON CONFLICT (slot) DO NOTHING`,
    ).run(JSON.stringify(saved));
  });
  once('tui.json', () => {
    const saved = readJson(LEGACY_FILES.uiState());
    if (!isRecord(saved)) return;
    const put = db.prepare(
      `INSERT INTO tui_ui_state (repo_path, data) VALUES (?, ?)
       ON CONFLICT (repo_path) DO NOTHING`,
    );
    for (const [repo, state] of Object.entries(saved)) {
      if (isRecord(state)) put.run(repo, JSON.stringify(state));
    }
  });
}

const decodeComment = Schema.decodeUnknownSync(ReviewComment);

/** Module-scoped so ids stay unique within a millisecond (server scheme). */
let counter = 0;

export interface NewDevCommand {
  name: string;
  command: string;
  cwd?: string;
}

export function createStore(db: Database) {
  const listComments = db.query<{ data: string }, [string]>(
    'SELECT data FROM comment WHERE repo_path = ? ORDER BY created_at ASC, id',
  );
  const findComment = db.query<{ data: string }, [string, string]>(
    'SELECT data FROM comment WHERE repo_path = ? AND id = ?',
  );
  const putComment = db.prepare(
    `INSERT INTO comment (id, repo_path, created_at, data) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       repo_path = excluded.repo_path,
       created_at = excluded.created_at,
       data = excluded.data`,
  );
  const deleteComment = db.prepare(
    'DELETE FROM comment WHERE repo_path = ? AND id = ?',
  );
  const findAim = db.query<{ target: string }, [string, string]>(
    'SELECT target FROM branch_target WHERE repo_path = ? AND branch = ?',
  );
  const putAim = db.prepare(
    `INSERT INTO branch_target (repo_path, branch, target) VALUES (?, ?, ?)
     ON CONFLICT (repo_path, branch) DO UPDATE SET target = excluded.target`,
  );
  const deleteAim = db.prepare(
    'DELETE FROM branch_target WHERE repo_path = ? AND branch = ?',
  );

  const listDevCommands = db.query<{ data: string }, [string]>(
    'SELECT data FROM dev_command WHERE repo_path = ? ORDER BY created_at ASC, id',
  );
  const putDevCommand = db.prepare(
    `INSERT INTO dev_command (id, repo_path, created_at, data) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET data = excluded.data`,
  );
  const deleteDevCommand = db.prepare(
    'DELETE FROM dev_command WHERE repo_path = ? AND id = ?',
  );

  const findSettings = db.query<{ data: string }, []>(
    'SELECT data FROM tui_settings WHERE slot = 0',
  );
  const putSettings = db.prepare(
    `INSERT INTO tui_settings (slot, data) VALUES (0, ?)
     ON CONFLICT (slot) DO UPDATE SET data = excluded.data`,
  );
  const findUiState = db.query<{ data: string }, [string]>(
    'SELECT data FROM tui_ui_state WHERE repo_path = ?',
  );
  const putUiState = db.prepare(
    `INSERT INTO tui_ui_state (repo_path, data) VALUES (?, ?)
     ON CONFLICT (repo_path) DO UPDATE SET data = excluded.data`,
  );
  const parsed = (row: { data: string } | null) => {
    try {
      return row ? (JSON.parse(row.data) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };

  return {
    /** The TUI's preferences as last saved, shared by every repository. */
    settings(): Record<string, unknown> | null {
      return parsed(findSettings.get());
    },

    saveSettings(settings: object): void {
      putSettings.run(JSON.stringify(settings));
    },

    /** The layout last left in `repo`. */
    uiState(repo: string): Record<string, unknown> | null {
      return parsed(findUiState.get(repo));
    },

    saveUiState(repo: string, state: object): void {
      putUiState.run(repo, JSON.stringify(state));
    },

    comments(repo: string): ReviewComment[] {
      return listComments.all(repo).flatMap(readable);
    },

    addComment(repo: string, input: NewComment): ReviewComment {
      counter += 1;
      const createdAt = new Date().toISOString();
      const comment: ReviewComment = {
        ...input,
        id: `c-${Date.now().toString(36)}-${counter}`,
        createdAt,
        source: 'local',
      };
      putComment.run(comment.id, repo, createdAt, JSON.stringify(comment));
      return comment;
    },

    updateComment(repo: string, id: string, body: string): void {
      const row = findComment.get(repo, id);
      const existing = row ? readable(row)[0] : undefined;
      if (!existing) throw new Error(`comment ${id} not found`);
      putComment.run(
        id,
        repo,
        existing.createdAt,
        JSON.stringify({ ...existing, body }),
      );
    },

    removeComment(repo: string, id: string): void {
      deleteComment.run(repo, id);
    },

    /** Where the branch's work is aimed — what the app compares it against by default. */
    branchAim(repo: string, branch: string): string | null {
      return findAim.get(repo, branch)?.target ?? null;
    },

    /** `null` clears the aim, leaving the branch on its uncommitted work. */
    setBranchAim(repo: string, branch: string, target: string | null): void {
      if (target === null) deleteAim.run(repo, branch);
      else putAim.run(repo, branch, target);
    },

    /** The repository's services — the Mac app's Run pane commands. */
    devCommands(repo: string): DevCommand[] {
      return listDevCommands.all(repo).flatMap((row) => {
        try {
          return [decodeStoredDevCommand(JSON.parse(row.data))];
        } catch {
          return [];
        }
      });
    },

    addDevCommand(repo: string, input: NewDevCommand): DevCommand {
      counter += 1;
      const now = new Date().toISOString();
      const command: DevCommand = {
        id: `d-${Date.now().toString(36)}-${counter}`,
        name: input.name.trim(),
        command: input.command.trim(),
        cwd: normalizeDevCwd(input.cwd ?? ''),
        createdAt: now,
        updatedAt: now,
      };
      putDevCommand.run(command.id, repo, now, JSON.stringify(command));
      return command;
    },

    removeDevCommand(repo: string, id: string): void {
      deleteDevCommand.run(repo, id);
    },

    close(): void {
      db.close();
    },
  };
}

/** One unreadable row drops out instead of failing the list. */
function readable(row: { data: string }): ReviewComment[] {
  try {
    return [decodeComment(JSON.parse(row.data))];
  } catch {
    return [];
  }
}

/** The migrations are typed for `node:sqlite`; they only call `exec`. */
type MigrationDb = Parameters<(typeof MIGRATIONS)[number]['up']>[0];

function migrate(db: Database) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS migration (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
  );
  const done = new Set(
    db
      .query<{ id: string }, []>('SELECT id FROM migration')
      .all()
      .map((row) => row.id),
  );
  const record = db.prepare(
    'INSERT INTO migration (id, applied_at) VALUES (?, ?)',
  );
  for (const migration of MIGRATIONS) {
    if (done.has(migration.id)) continue;
    db.transaction(() => {
      migration.up(db as unknown as MigrationDb);
      record.run(migration.id, new Date().toISOString());
    })();
  }
}
