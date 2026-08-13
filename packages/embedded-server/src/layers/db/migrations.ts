/**
 * The database schema, as an ordered list of migrations.
 *
 * Each entry runs exactly once, inside a transaction, and its id is recorded in
 * `migration` — so a byconvo that has already opened the file only runs what it
 * has not seen. Append; never edit a shipped entry.
 *
 * Two shapes of table live here on purpose:
 *
 * - **Columns** for what is queried — ids, the scope a row belongs to, the
 *   timestamps rows are sorted by, and (for chats) the message and activity
 *   rows a streaming turn rewrites one at a time.
 * - **A `data` JSON column** for the rest of a document. The feature's Effect
 *   `Schema` stays the single definition of that shape: rows are encoded on
 *   write and decoded on read, so adding a field to a schema is not a
 *   migration.
 */
import type { DatabaseSync } from "node:sqlite";

export interface Migration {
  readonly id: string;
  readonly up: (db: DatabaseSync) => void;
}

const initial = `
CREATE TABLE project (
  path       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  opened_at  TEXT NOT NULL
);

CREATE TABLE repo (
  path         TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  name         TEXT NOT NULL,
  seen_at      TEXT NOT NULL
);
CREATE INDEX repo_project ON repo (project_path);

CREATE TABLE chat (
  id          TEXT PRIMARY KEY,
  repo_path   TEXT NOT NULL,
  title       TEXT NOT NULL,
  provider    TEXT NOT NULL,
  model       TEXT NOT NULL,
  effort      TEXT NOT NULL,
  access      TEXT NOT NULL,
  branch      TEXT NOT NULL,
  session_id  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  latest_turn TEXT
);
CREATE INDEX chat_updated_at ON chat (updated_at DESC);
CREATE INDEX chat_repo ON chat (repo_path);

CREATE TABLE chat_message (
  id          TEXT PRIMARY KEY,
  chat_id     TEXT NOT NULL REFERENCES chat (id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  role        TEXT NOT NULL,
  text        TEXT NOT NULL,
  turn_id     TEXT NOT NULL,
  streaming   INTEGER NOT NULL,
  pending     INTEGER NOT NULL,
  attachments TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX chat_message_chat ON chat_message (chat_id, seq);

CREATE TABLE chat_activity (
  id         TEXT PRIMARY KEY,
  chat_id    TEXT NOT NULL REFERENCES chat (id) ON DELETE CASCADE,
  seq        INTEGER NOT NULL,
  turn_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  tone       TEXT NOT NULL,
  summary    TEXT NOT NULL,
  detail     TEXT,
  call_id    TEXT,
  label      TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX chat_activity_chat ON chat_activity (chat_id, seq);

CREATE TABLE comment (
  id         TEXT PRIMARY KEY,
  repo_path  TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data       TEXT NOT NULL
);
CREATE INDEX comment_repo ON comment (repo_path, created_at);

CREATE TABLE visual_comment (
  id         TEXT PRIMARY KEY,
  repo_path  TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data       TEXT NOT NULL
);
CREATE INDEX visual_comment_repo ON visual_comment (repo_path, created_at);

CREATE TABLE thread (
  id         TEXT PRIMARY KEY,
  repo_path  TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data       TEXT NOT NULL
);
CREATE INDEX thread_repo ON thread (repo_path, updated_at DESC);

CREATE TABLE plan (
  id         TEXT PRIMARY KEY,
  repo_path  TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data       TEXT NOT NULL
);
CREATE INDEX plan_repo ON plan (repo_path, updated_at DESC);

CREATE TABLE dev_command (
  id         TEXT PRIMARY KEY,
  repo_path  TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data       TEXT NOT NULL
);
CREATE INDEX dev_command_repo ON dev_command (repo_path, created_at);

CREATE TABLE task_board (
  repo_path TEXT PRIMARY KEY,
  prefix    TEXT NOT NULL,
  counter   INTEGER NOT NULL,
  columns   TEXT NOT NULL
);

CREATE TABLE task_card (
  id         TEXT PRIMARY KEY,
  repo_path  TEXT NOT NULL,
  column_id  TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  data       TEXT NOT NULL
);
CREATE INDEX task_card_repo ON task_card (repo_path, sort_order);

CREATE TABLE legacy_import (
  repo_path   TEXT NOT NULL,
  feature     TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  PRIMARY KEY (repo_path, feature)
);
`;

export const MIGRATIONS: ReadonlyArray<Migration> = [
  { id: "0001_initial", up: (db) => db.exec(initial) },
];
