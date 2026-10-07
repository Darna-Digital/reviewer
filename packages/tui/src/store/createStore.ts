import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
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
  return createStore(db);
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

  return {
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
