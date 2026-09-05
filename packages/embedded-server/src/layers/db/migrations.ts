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

/** Where each branch's work is aimed, per repository. */
const branchTargets = `
CREATE TABLE branch_target (
  repo_path TEXT NOT NULL,
  branch    TEXT NOT NULL,
  target    TEXT NOT NULL,
  PRIMARY KEY (repo_path, branch)
);
`;

/**
 * Collaboration — projects, the work under them, the notes beside them, and
 * the things a person has starred.
 *
 * The feature is gone (see `0006_drop_tasks_collab`), but the entry stays: a
 * shipped migration is never edited, so a database that has not seen this one
 * still creates the tables here before the next one drops them again.
 */
const collabTables = `
CREATE TABLE collab_project (
  id         TEXT PRIMARY KEY,
  repo_path  TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data       TEXT NOT NULL
);
CREATE INDEX collab_project_repo ON collab_project (repo_path, created_at DESC);

CREATE TABLE collab_todo (
  id         TEXT PRIMARY KEY,
  repo_path  TEXT NOT NULL,
  project_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data       TEXT NOT NULL
);
CREATE INDEX collab_todo_repo ON collab_todo (repo_path, created_at);
CREATE INDEX collab_todo_project ON collab_todo (repo_path, project_id);

CREATE TABLE collab_note (
  id         TEXT PRIMARY KEY,
  repo_path  TEXT NOT NULL,
  project_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data       TEXT NOT NULL
);
CREATE INDEX collab_note_repo ON collab_note (repo_path, updated_at DESC);
CREATE INDEX collab_note_project ON collab_note (repo_path, project_id);

CREATE TABLE collab_bookmark (
  id         TEXT PRIMARY KEY,
  repo_path  TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data       TEXT NOT NULL
);
CREATE INDEX collab_bookmark_repo ON collab_bookmark (repo_path, created_at DESC);
`;

/**
 * When the reader last had a session open. The sessions list's dots — the one
 * for a turn that ended badly and the one for "this moved" — are both read off
 * this mark, which is why it belongs to the session rather than to the inbox:
 * opening a conversation has to be able to settle its own row.
 *
 * Sessions that predate the column start at `NULL`, which reads as never
 * opened; the first visit stamps them.
 */
const chatSeenAt = `ALTER TABLE chat ADD COLUMN seen_at TEXT`;

/**
 * The app's connection to byconvo cloud: which server, the bearer token once
 * the device flow has granted one, and the code while it is still pending.
 * One row for the whole machine — the connection is the app's, not a
 * project's — held as a single JSON document decoded through
 * `@byconvo/core/cloud`'s `StoredCloudConnection`. The token rests here in
 * the clear like the rest of `~/.byconvo`: this is the user's own machine.
 */
const cloudConnection = `
CREATE TABLE cloud_connection (
  id   INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL
);
`;

/**
 * Tasks and collaboration, taken back out.
 *
 * Both features were removed from the app, so their tables are the only thing
 * left of them. Dropping them here rather than editing `0001_initial` and
 * `0003_collab` keeps the rule this file is built on: a shipped entry is never
 * edited, so every database — one opened for the first time and one that has
 * been carrying these tables for months — ends up in the same place.
 */
const dropTasksAndCollab = `
DROP TABLE IF EXISTS task_card;
DROP TABLE IF EXISTS task_board;
DROP TABLE IF EXISTS collab_bookmark;
DROP TABLE IF EXISTS collab_note;
DROP TABLE IF EXISTS collab_todo;
DROP TABLE IF EXISTS collab_project;
`;

export const MIGRATIONS: ReadonlyArray<Migration> = [
  { id: "0001_initial", up: (db) => db.exec(initial) },
  { id: "0002_branch_target", up: (db) => db.exec(branchTargets) },
  { id: "0003_collab", up: (db) => db.exec(collabTables) },
  { id: "0004_chat_seen_at", up: (db) => db.exec(chatSeenAt) },
  { id: "0005_cloud_connection", up: (db) => db.exec(cloudConnection) },
  { id: "0006_drop_tasks_collab", up: (db) => db.exec(dropTasksAndCollab) },
];
